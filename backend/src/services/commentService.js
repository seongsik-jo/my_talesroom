const commentRepository = require('../repositories/commentRepository');
const { User } = require('../models');
const { calculateGrade } = require('./userService');

// 1. 댓글 작성 비즈니스 로직
const createComment = async (postId, content, loginUser) => {
    // 내용 검증 (1 ~ 1000자 / 빈 값 체크)
    if (!content || content.trim().length === 0 || content.length > 1000) {
        const error = new Error('내용을 입력해주세요.');
        error.status = 400;
        throw error;
    }

    // 게시글 존재 여부 확인 
    const post = await commentRepository.findPostById(postId);
    if (!post) {
        const error = new Error('게시글을 찾을 수 없습니다.');
        error.status = 404;
        throw error;
    }

    // 댓글 생성
    const newComment = await commentRepository.createComment(content, postId, loginUser.id);

    // 댓글 작성 시 활동 점수 +3점 적립 및 등급 자동 갱신
    const dbUser = await User.findByPk(loginUser.id);
    if (dbUser) {
        const newScore = (dbUser.score || 0) + 3;
        const newGrade = calculateGrade(newScore);
        await dbUser.update({ score: newScore, grade: newGrade });
    }

    // 질문 카테고리인 경우 메시지 분기 처리
    const successMessage = post.category === 'QUESTION'
        ? '답변이 등록되었습니다.'
        : '댓글이 등록되었습니다.';

    return {
        id: newComment.id,
        author: dbUser ? { id: dbUser.id, nickname: dbUser.nickname, grade: dbUser.grade } : null,
        message: successMessage
    };
};

// 2. 댓글 삭제 비즈니스 로직 (댓글 삭제 시 점수 -3점 차감 및 등급 갱신 반영)
const deleteComment = async (commentId, loginUser) => {
    // 댓글 존재 여부 확인  
    const comment = await commentRepository.findCommentById(commentId);
    if (!comment) {
        const error = new Error('댓글을 찾을 수 없습니다.');
        error.status = 404;
        throw error;
    }

    // 채택된 답변인지 확인
    if (comment.isAccepted) {
        const error = new Error('채택된 답변은 삭제할 수 없습니다.');
        error.status = 400;
        throw error;
    }

    // 권한 검사 (작성자 본인 또는 관리자)
    const isOwner = comment.userId === loginUser.id;
    const isAdmin = loginUser.role?.toUpperCase() === 'ADMIN';

    if (!isOwner && !isAdmin) {
        const error = new Error('작성자 또는 관리자만 삭제할 수 있습니다.');
        error.status = 403;
        throw error;
    }

    // 1. 댓글 삭제 실행 
    await commentRepository.removeComment(comment);

    // 2. 🏆 댓글 작성자(comment.userId)의 점수 -3점 차감 및 등급 갱신
    const authorUser = await User.findByPk(comment.userId);
    if (authorUser) {
        const newScore = Math.max((authorUser.score || 0) - 3, 0);
        const newGrade = calculateGrade(newScore);
        await authorUser.update({ score: newScore, grade: newGrade });
    }

    return true;
};

//3. 답변 채택 비즈니스 로직
const acceptComment = async (commentId, loginUser) => {

    // 댓글 존재 여부 확인
    const comment = await commentRepository.findCommentById(commentId);

    if (!comment){
        const error= new Error('댓글을 찾을 수 없습니다.');
        error.status = 404;
        throw error;
    }

    // 게시글 존재 여부 확인
    const post = await commentRepository.findPostById(comment.postId);

    if (!post){
        const error = new Error('게시글을 찾을 수 없습니다.');
        error.status = 404;
        throw error;
    }

    // 질문 카테고리인지 확인
    if (post.category !== 'QUESTION'){
        const error = new Error('질문 카테고리 글만 채택할 수 있습니다.');
        error.status = 400;
        throw error;
    }

    // 질문 작성자인지 확인
    if (post.userId !== loginUser.id){
        const error = new Error('질문 작성자만 채택할 수 있습니다.');
        error.status = 403;
        throw error;
    }

    // 본인 댓글은 채택 불가
    if (comment.userId === loginUser.id) {
        const error = new Error('본인 댓글은 채택할 수 없습니다.');
        error.status = 400;
        throw error;
    }

    // 이미 채택된 답변이 있는지 확인. 있으면 400 반환
    const accepted = await commentRepository.findAcceptedComment(post.id);

    if (accepted) {
        const error = new Error('이미 채택된 답변이 있습니다.');
        error.status = 400;
        throw error;
    }

    // 답변 채택
    await commentRepository.acceptComment(comment);

    return {
        postId: post.id,
        acceptedId: comment.id,
        isSolved: true // 추후 게시글 조회 api 수정시 수정 필요
    };
};


module.exports = { createComment, deleteComment, acceptComment };
