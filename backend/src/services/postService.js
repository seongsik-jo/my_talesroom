const { sequelize } = require('../models');
const User = require('../models/User');
const postRepository = require('../repositories/postRepository');
const postReactionRepository = require('../repositories/postReactionRepository');//좋아요 DB 작업
const { calculateGrade } = require('./userService');
const CATEGORIES = ['INFO', 'QUESTION', 'CHAT', 'DEBATE'];          // 카테고리 구분

function httpError(status, message) {
    const err = new Error(message);                     // 사용자 노출 문구
    err.status = status;
    return err;
}

function toListItem(post, stats) {
    const p = post.get({ plain: true });
    return {
        id: p.id,
        category: p.category,
        title: p.title,
        author: p.author,
        viewCount: p.viewCount,
        isSpoiler: p.isSpoiler === 1 || p.isSpoiler === true,
        isSolved: stats?.isSolved ?? false,
        commentCount: stats?.commentCount ?? 0,
        likeCount: stats?.likeCount ?? 0,
        createdAt: p.createdAt,
    };
}

// 주소 뒤 값들 문자열로 불러오기
async function getPosts(query) {
    const { category, keyword } = query;

    if (category && !CATEGORIES.includes(category)) {   // 카테고리 검사
        throw httpError(400, '잘못된 카테고리입니다.');
    }
    const page = Math.max(parseInt(query.page, 10) || 1, 1); // 페이지 검사
    const size = Math.min(Math.max(parseInt(query.size, 10) || 10, 1), 50);
    const offset = (page - 1) * size;

    const [notices, result] = await Promise.all([                 // 공지 + 일반글 불러오기
        postRepository.findNotices(),
        postRepository.findPage({
            category,
            keyword: keyword ? keyword.trim() : undefined,        // 공백 제거
            limit: size,
            offset,
        }),
    ]);
    const stats = await postRepository.findListStats([...notices, ...result.rows].map(post => post.id));
    return {                                                      // 명세서 응답 양식
        notices: notices.map(post => toListItem(post, stats.get(String(post.id)))),
        items: result.rows.map(post => toListItem(post, stats.get(String(post.id)))),
        page,
        size,
        totalCount: result.count,
        totalPages: Math.ceil(result.count / size),       // 올림
    };
}

// 게시글 상세 조회
async function getPostDetail(id, user) {
    // 1. 게시글 존재 여부 확인
    const post = await postRepository.findById(id);
    if (!post) { throw httpError(404, '게시글을 찾을 수 없습니다.'); }

    // 2. 조회수 1 증가 실행
    await postRepository.viewCount(post);

    // 3. 연관된 작성자, 댓글, 좋아요 데이터가 포함된 상세 정보 조회
    const detailedPost = await postRepository.findByIdWithDetails(id);
    const p = detailedPost.get({plain: true});

    const likeCount = await postReactionRepository.countReactions(p.id); //실제 좋아요 수 조회

    // 4. 로그인 User의 좋아요 누름 여부
    // const reaction = await postRepository.findReaction(id, user ? user.id : null);
    const reaction = await postReactionRepository.findReaction(p.id, user ? user.id : null);//(user ? user.id : null) -> user.id게시글을 로그인 해야 확인 가능하므로 해당 부분의 처리가 상세에서 추가 되면 변경 될 부분
    const liked = !!reaction;// !!reaction -> !로 값을 boolean으로 변환 처리 !!로 원래 의미로 처리(좋아요 값이 있으면 true, 없으면(null) false)

    // comments 배열에서 채택된 댓글(isAccepted === 1)을 찾아 acceptedId 추출
    const commentsList = p.comments || [];
    const acceptedComment = commentsList.find(c => c.isAccepted === 1 || c.isAccepted === true);
    const acceptedId = acceptedComment ? acceptedComment.id : null;

    // 6. 데이터 조립 및 반환
    return { 
        id: p.id, 
        category: p.category, 
        title: p.title,
        content: p.content,
        isSpoiler: p.isSpoiler === 1,
        isNotice: p.isNotice === 1,
        isSolved: acceptedId !== null, //채택된 ID가 있으면 해결된 글 
        acceptedId:acceptedId,
        viewCount: p.viewCount,
        likeCount: likeCount, // 좋아요 총 갯수 
        liked:liked, // 본인이 좋아요 눌렀는지 여부 
        isMine: user ? p.userId === user.id : false, // 내가 작성한 글인지 여부 
        author: p.author,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        comments: (p.comments || []).map(comment => ({
            id: comment.id,
            content: comment.content,
            isAccepted: comment.id === acceptedId, // 해당 댓글이 채택되었는지 여부
            author: comment.author,
            createdAt: comment.createdAt,
        })),
    };
}

// 작성, 수정 공통 입력 검사
function validatePostBody(user, body) {
    const { category, title, content, isNotice } = body;
    if (!category || !title || !content) throw httpError(400, '필수 값이 누락되었습니다.');
    if (!CATEGORIES.includes(category)) throw httpError(400, '잘못된 카테고리 값입니다.');
    if (title.length > 200) throw httpError(400, '제목은 200자 이하로 입력해주세요.');
    if (isNotice && user.role?.toUpperCase() !== 'ADMIN') throw httpError(403, '공지 설정은 관리자만 가능합니다.');
}

// 게시글 작성 (작성 시 점수 +10점 부여 및 등급 자동 갱신)
async function createPost(user, body) {                 
    const { category, title, content, isSpoiler, isNotice } = body;

    validatePostBody(user, body);   

    const post = await postRepository.create({
        userId: user.id,
        category,
        title,
        content,
        isSpoiler: isSpoiler ? 1 : 0, 
        isNotice: isNotice ? 1 : 0,
    });

    // 게시글 작성 시 활동 점수 +10점 적립 및 등급 자동 갱신
    const dbUser = await User.findByPk(user.id);
    if (dbUser) {
        const newScore = (dbUser.score || 0) + 10;
        const newGrade = calculateGrade(newScore);
        await dbUser.update({ score: newScore, grade: newGrade });
    }

    return { id: post.id };
}

// 삭제 함수 (게시글 삭제 시 점수 -10점 차감 및 등급 재계산 반영)
async function deletePost(user, id) {
    const post = await postRepository.findById(id);     
    if (!post) throw httpError(404, '게시글을 찾을 수 없습니다.');
    const isOwner = post.userId === user.id;        
    const isAdmin = user.role?.toUpperCase() === 'ADMIN';
    if (!isOwner && !isAdmin) throw httpError(403, '작성자 또는 관리자만 삭제할 수 있습니다.');

    // 1. 게시글 삭제 실행
    await postRepository.remove(post);                  

    // 2. 게시글 작성자(post.userId)의 점수 -10점 차감 및 등급 갱신
    // (관리자가 남의 글을 지웠을 경우에도 실제 글 작성자의 점수가 깎이도록 post.userId 기준 처리)
    const authorUser = await User.findByPk(post.userId);
    if (authorUser) {
        // 점수가 0 밑으로 떨어지지 않도록 Math.max 처리
        const newScore = Math.max((authorUser.score || 0) - 10, 0);
        const newGrade = calculateGrade(newScore);
        await authorUser.update({ score: newScore, grade: newGrade });
    }
}

// 수정 함수
async function updatePost(user, id, body) {
    const post = await postRepository.findById(id);             // 1. 글이 있는지?
    if (!post) throw httpError(404, '게시글을 찾을 수 없습니다.');
    const isOwner = post.userId === user.id;                // 2. 권한: 작성자 본인인지?
    const isAdminOnNotice = post.isNotice === 1 && user.role?.toUpperCase() === 'ADMIN';
    if (!isOwner && !isAdminOnNotice) throw httpError(403, '작성자만 수정할 수 있습니다.');

    validatePostBody(user, body);                               // 3. 입력 검사

    await sequelize.transaction(async (t) => {                // 4. 트랜잭션: 전부 성공 or 전부 취소
        await postRepository.createLog({                        // 4-1. 수정 전 내용 저장
            postId: post.id,
            userId: user.id,
            category: post.category,
            title: post.title,
            content: post.content,
            isSpoiler: post.isSpoiler,
            isNotice: post.isNotice,
        }, { transaction: t });

        await postRepository.update(post, {
            category: body.category,                              // 4-2. 새 내용으로 수정
            title: body.title,
            content: body.content,
            isSpoiler: body.isSpoiler ? 1 : 0,
            isNotice: body.isNotice ? 1 : 0,
        }, { transaction: t });
    });
    return { id: post.id };
}

//좋아요 토글 (처음 누르면 좋아요(추가), 다시 누르면 좋아요 취소(삭제))
async function toggleLike(user, id) {
    //게시글 체크
    const post = await postRepository.findById(id);
    if (!post) throw httpError(404, '게시글을 찾을 수 없습니다.');

    //로그인 User의 좋아요 누름 여부
    const reaction = await postReactionRepository.findReaction(post.id, user.id);

    if (reaction) {//자바 스크립트에서 reaction이 null이면 false, 객체가 있으면 true로 판단
        await postReactionRepository.removeReaction(reaction); //이미 눌렀으면 -> 삭제
    } else {
        await postReactionRepository.createReaction(post.id, user.id); //안 눌렀으면 -> 좋아요 추가
    }

    //바뀐 결과를 돌려줌(반영), (프론트는 이 값으로 버튼 상태를 바꿀 수 있음)
    //const likeCount = await postReactionRepository.countReactions(post.id); //이부분은 카운트 변경도 필요시 활성
    return {
        liked: !reaction, //변경 상태인 boolean 값을 liked로 돌려줌
        //likeCount, //이부분은 카운트 변경도 필요시 활성
    };
}

module.exports = { getPosts, getPostDetail, createPost, updatePost, deletePost, toggleLike };
