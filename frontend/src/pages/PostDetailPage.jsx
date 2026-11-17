import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PostDeleteButton from '../components/PostDeleteButton';
import CommentSection from '../components/CommentSection';
import CategoryBadge from '../components/CategoryBadge';
import SpoilerCheckModal from '../components/SpoilerCheckModal';
import useAuth from '../hooks/useAuth';
import useDialog from '../hooks/useDialog';
import api, { getErrorMessage } from '../api/axiosInstance';
import { formatDate } from '../utils/postFormat';
import { isAcceptedReply, isSolvedPost, postFlag } from '../utils/communityPost';
import '../styles/PostDetail.css';

function PostDetail({ id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm } = useDialog();
  const [state, setState] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/posts/${id}`, { signal: controller.signal }).then((response) => {
      const post = response.data.data || response.data;
      if (!post?.id) throw new Error('Invalid post response');
      if (!controller.signal.aborted) setState({ loading: false, post });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ loading: false, error: getErrorMessage(error, '게시글을 불러오지 못했습니다.') });
    });
    return () => controller.abort();
  }, [id, retry]);
  const post = state.post;
  const changePost = (update) => setState((current) => ({ ...current, post: update(current.post) }));
  async function action(work) {
    if (pending) return;
    setPending(true); setActionError(''); setNotice('');
    try { await work(); } catch (error) { setActionError(getErrorMessage(error, '요청을 처리하지 못했습니다. 다시 시도해 주세요.')); }
    finally { setPending(false); }
  }
  function submitComment(event) {
    event.preventDefault();
    const content = commentContent.trim();
    if (!content) return;
    action(async () => {
      const response = await api.post(`/posts/${id}/comments`, { content });
      const data = response.data.data || response.data;
      changePost((current) => ({ ...current, comments: [...(current.comments || []), { id: data.id, content, author: data.author || { id: user.id ?? user.userId, nickname: user.nickname, grade: user.grade }, createdAt: new Date().toISOString(), isAccepted: false }] }));
      setCommentContent(''); setNotice('댓글이 등록되었습니다.');
    });
  }
  async function removeComment(commentId) {
    if (!await showConfirm('이 댓글을 삭제하시겠습니까?', { description: '삭제한 댓글은 복구할 수 없습니다.', confirmText: '삭제', danger: true })) return;
    action(async () => {
      await api.delete(`/comments/${commentId}`);
      changePost((current) => {
        const comments = (current.comments || []).filter((comment) => comment.id !== commentId);
        const accepted = comments.find((comment) => isAcceptedReply(comment, current.acceptedId));
        return { ...current, comments, isSolved: Boolean(accepted), acceptedId: accepted?.id ?? null };
      });
      setNotice('댓글이 삭제되었습니다.');
    });
  }
  async function acceptComment(commentId) {
    if (!await showConfirm('이 댓글을 답변으로 채택하시겠습니까?', { description: '질문이 해결됨으로 표시됩니다.', confirmText: '채택' })) return;
    action(async () => {
      const response = await api.patch(`/comments/${commentId}/accept`);
      const data = response.data.data;
      changePost((current) => ({ ...current, isSolved: true, acceptedId: data?.acceptedId ?? commentId, comments: (current.comments || []).map((comment) => ({ ...comment, isAccepted: String(comment.id) === String(data?.acceptedId ?? commentId) })) }));
      setNotice('답변이 채택되었습니다.');
    });
  }
  function toggleLike() {
    if (!user) return navigate('/login');
    action(async () => {
      const response = await api.post(`/posts/${id}/like`);
      const data = response.data.data;
      changePost((current) => ({ ...current, liked: data.liked, likeCount: data.likeCount ?? Math.max(0, Number(current.likeCount || 0) + (postFlag(data.liked) ? 1 : -1)) }));
    });
  }

  if (state.loading) return <div className="post-detail-container post-detail-state" role="status">게시글을 불러오는 중입니다…</div>;
  if (state.error) return <div className="post-detail-container post-detail-state" role="alert"><p>{state.error}</p><button onClick={() => setRetry((value) => value + 1)}>다시 시도</button><Link to="/posts">커뮤니티로 돌아가기</Link></div>;
  const isMine = postFlag(post.isMine) || Boolean(user && (user.id ?? user.userId) != null && (post.author?.id ?? post.author?.userId) != null && String(user.id ?? user.userId) === String(post.author.id ?? post.author.userId));
  const name = post.author?.nickname || '익명';
  const hidden = postFlag(post.isSpoiler) && !confirmed;
  return <article className="post-detail-container">
    <SpoilerCheckModal isOpen={hidden} onConfirm={() => setConfirmed(true)} onCancel={() => navigate('/posts')} />
    <Link to="/posts" className="post-detail-back">‹ 커뮤니티로 돌아가기</Link>
    <header className="post-detail-header"><div className="post-detail-badges"><CategoryBadge category={post.category} notice={postFlag(post.isNotice)} />{isSolvedPost(post) && <span className="post-solved-badge">해결됨</span>}{postFlag(post.isSpoiler) && <span className="post-spoiler-badge">스포일러</span>}</div><h1>{post.title}</h1>
      <div className="post-detail-meta"><span className="post-avatar" aria-hidden="true">{Array.from(name)[0]}</span><strong>{name}</strong>{post.author?.grade && <span className="post-grade-badge">{post.author.grade}</span>}<time dateTime={post.createdAt}>{formatDate(post.createdAt)} {post.createdAt ? new Date(post.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</time><span>조회 {post.viewCount ?? 0}</span><div className="post-detail-owner-actions">{isMine && <Link to={`/posts/${id}/edit`}>수정</Link>}{(isMine || user?.role?.toUpperCase() === 'ADMIN') && <PostDeleteButton postId={post.id} className="post-detail-delete" />}</div></div>
    </header>
    <div className={`post-detail-body ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden}>{hidden ? '스포일러 확인 후 본문을 볼 수 있습니다.' : post.content}</div>
    <div className="post-detail-like-row"><button className={`post-detail-like ${postFlag(post.liked) ? 'is-liked' : ''}`} disabled={pending || hidden} aria-pressed={postFlag(post.liked)} onClick={toggleLike}><span aria-hidden="true">{postFlag(post.liked) ? '♥' : '♡'}</span> 좋아요 {post.likeCount ?? 0}</button></div>
    {notice && <p className="post-detail-notice" role="status">{notice}</p>}{actionError && <p className="post-detail-error" role="alert">{actionError}</p>}
    {!hidden && <CommentSection post={{ ...post, isMine }} commentContent={commentContent} setCommentContent={setCommentContent} onCommentSubmit={submitComment} onCommentDelete={removeComment} onCommentAccept={acceptComment} user={user} isAdmin={user?.role?.toUpperCase() === 'ADMIN'} pending={pending} />}
  </article>;
}

export default function PostDetailPage() {
  const { id } = useParams();
  return <PostDetail key={id} id={id} />;
}
