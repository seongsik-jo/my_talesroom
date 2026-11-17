import { startTransition, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MyPageHeader from "../components/MyPageHeader";
import { getErrorMessage } from "../api/axiosInstance";
import { fetchMyComments, fetchMyInfo, fetchMyPosts } from "../api/userApi";
import { formatDate } from "../utils/postFormat";
import useAuth from "../hooks/useAuth";
import "../styles/MyPage.css";

function MyPagePage() {
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ posts: 0, comments: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let ignore = false;

    Promise.all([
      fetchMyInfo(),
      fetchMyPosts({ page: 1, size: 1 }),
      fetchMyComments({ page: 1, size: 1 }),
    ])
      .then(([info, posts, comments]) => {
        if (ignore) return;
        setProfile(info);
        setCounts({ posts: posts.totalCount, comments: comments.totalCount });
      })
      .catch((requestError) => {
        if (!ignore)
          setError(
            getErrorMessage(
              requestError,
              "마이페이지 정보를 불러오지 못했어요.",
            ),
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleLogout = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    startTransition(() => {
      logout();
      navigate("/", { replace: true });
    });
  };

  const handleRetry = () => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  };

  const initial = Array.from(profile?.nickname?.trim() || "나")[0];

  return (
    <div className="mypage-shell">
      <MyPageHeader
        eyebrow="MY PAGE"
        title="마이페이지"
        description="내 정보와 커뮤니티 활동을 한눈에 확인하세요."
      />

      {location.state?.message && (
        <p className="mypage-notice" role="status">
          {location.state.message}
        </p>
      )}

      {loading ? (
        <div className="mypage-card mypage-state">
          정보를 불러오는 중이에요.
        </div>
      ) : error ? (
        <div className="mypage-card mypage-state">
          <p>{error}</p>
          <button type="button" onClick={handleRetry}>
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <section className="mypage-card mypage-profile-card">
            <div className="mypage-profile">
              <span className="mypage-avatar" aria-hidden="true">
                {initial}
              </span>
              <div>
                <div className="mypage-name-grade">
                  <h2>{profile.nickname}</h2>
                  <div className="mypage-gradeBadge">{profile.grade}</div>
                </div>
                <p>{profile.email}</p>
                <span>가입일 {formatDate(profile.createdAt)}</span>
              </div>
            </div>
            <Link to="/mypage/edit" className="mypage-outline-button">
              내 정보 수정
            </Link>
          </section>

          <section className="mypage-stats" aria-label="활동 통계">
            <Link to="/mypage/posts" className="mypage-stat-card">
              <span>내가 쓴 글</span>
              <strong>
                {counts.posts}
                <small>개</small>
              </strong>
            </Link>
            <Link to="/mypage/comments" className="mypage-stat-card">
              <span>내가 쓴 댓글</span>
              <strong>
                {counts.comments}
                <small>개</small>
              </strong>
            </Link>
            <div className="mypage-stat-card">
              <span>내 활동 점수</span>
              <strong>
                {profile.score}
                <small>점</small>
              </strong>
            </div>
          </section>

          <section className="mypage-card mypage-activity-card">
            <h2>내 활동</h2>
            <Link to="/mypage/posts" className="mypage-activity-link">
              <span className="mypage-activity-icon" aria-hidden="true">
                ▤
              </span>
              <span className="mypage-activity-copy">
                <strong>내가 쓴 글 보기</strong>
                <small>작성한 게시글을 확인하고 관리해요.</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
            <Link to="/mypage/comments" className="mypage-activity-link">
              <span className="mypage-activity-icon" aria-hidden="true">
                ☷
              </span>
              <span className="mypage-activity-copy">
                <strong>내가 쓴 댓글 보기</strong>
                <small>커뮤니티에 남긴 답변과 댓글을 확인해요.</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
            <Link to="/mypage/bookmarks" className="mypage-activity-link">
              <span className="mypage-activity-icon" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                >
                  <path d="M6 3h12v18l-6-4-6 4Z" />
                </svg>
              </span>
              <span className="mypage-activity-copy">
                <strong>내 북마크 테마 보기</strong>
                <small>관심 있는 방탈출 테마를 모아보세요.</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
            {user?.role?.toUpperCase() === "ADMIN" && (
              <Link to="/admin/users" className="mypage-activity-link">
                <span className="mypage-activity-icon" aria-hidden="true">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <circle cx="9" cy="7" r="3" />
                    <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v2" />
                  </svg>
                </span>
                <span className="mypage-activity-copy">
                  <strong>회원 목록 관리</strong>
                  <small>관리자 전용 회원 목록을 확인해요.</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            )}
          </section>

          <div className="mypage-bottom-row">
            <button
              type="button"
              className="mypage-logout"
              onClick={handleLogout}
            >
              로그아웃
            </button>
            <p>※ 회원 목록 및 관리자 기능은 관리자 계정에만 표시됩니다.</p>
          </div>
        </>
      )}
    </div>
  );
}

export default MyPagePage;
