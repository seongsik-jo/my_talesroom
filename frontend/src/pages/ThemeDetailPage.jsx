import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createThemeReview,
  deleteTheme,
  deleteThemeReview,
  getTheme,
  getThemeReviews,
  themeError,
} from "../api/themeApi";
import useAuth from "../hooks/useAuth";
import ThemeThumbnail from "../components/ThemeThumbnail";
import BookmarkButton from "../components/BookmarkButton";
import ThemeMap from "../components/ThemeMap";
import "../styles/ThemePages.css";

function Stars({ value }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span
      className="theme-stars"
      aria-label={`${Number(value || 0).toFixed(1)}점`}
    >
      {"★".repeat(Math.min(5, Math.max(0, filled)))}
      {"☆".repeat(5 - Math.min(5, Math.max(0, filled)))}
    </span>
  );
}

function Reviews({ id, user, summary, onSummary }) {
  const [state, setState] = useState({ loading: true, items: [] });
  const [retry, setRetry] = useState(0);
  const [writing, setWriting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    getThemeReviews(id, controller.signal, page)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ ...data, loading: false });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, items: [], error: themeError(err) });
        }
      });
    return () => controller.abort();
  }, [id, retry, page]);
  const isMine = (review) =>
    Boolean(
      user &&
      review.author?.userId != null &&
      (user.id ?? user.userId) != null &&
      String(review.author.userId) === String(user.id ?? user.userId),
    );
  const alreadyReviewed =
    summary.myReviewed === true || state.items.some(isMine);
  const totalPages = state.totalPages || 0;

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const content = values.get("content").trim();
    if (!content) return setError("후기 내용을 입력해 주세요.");
    setPending(true);
    setError("");
    try {
      const result = await createThemeReview(id, {
        rating: Number(values.get("rating")),
        content,
      });
      onSummary({ ...result, myReviewed: true });
      setWriting(false);
      setPage(1);
      setNotice("후기가 등록되었습니다.");
      setRetry((value) => value + 1);
    } catch (err) {
      setError(themeError(err));
    } finally {
      setPending(false);
    }
  }
  async function removeReview() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await deleteThemeReview(
        id,
        isMine(deleteTarget) ? undefined : deleteTarget.author.userId,
      );
      onSummary({
        ...result,
        myReviewed: isMine(deleteTarget) ? false : summary.myReviewed,
      });
      setDeleteTarget(null);
      setPage(1);
      setNotice("후기가 삭제되었습니다.");
      setRetry((value) => value + 1);
    } catch (err) {
      setError(themeError(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="theme-panel theme-reviews">
      <div className="theme-results-heading">
        <h2>
          평점 · 후기{" "}
          <span>{summary.reviewCount ?? state.totalCount ?? "—"}</span>
        </h2>
        {user ? (
          <button
            className="theme-primary"
            disabled={
              state.loading ||
              Boolean(state.error) ||
              alreadyReviewed ||
              pending
            }
            onClick={() => setWriting((value) => !value)}
          >
            {alreadyReviewed
              ? "이미 이 테마에 후기를 작성했습니다"
              : writing
                ? "작성 닫기"
                : "＋ 후기 남기기"}
          </button>
        ) : (
          <Link className="theme-primary" to="/login">
            로그인하고 후기 남기기
          </Link>
        )}
      </div>
      {notice && (
        <p role="status" className="theme-notice">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="theme-error">
          {error}
        </p>
      )}
      {state.loading ? (
        <p role="status">후기를 불러오는 중입니다…</p>
      ) : state.error ? (
        <div role="alert">
          <p>{state.error}</p>
          <button
            className="theme-reset"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className="theme-review-summary">
            {summary.avgRating != null ? (
              <>
                <strong>{Number(summary.avgRating).toFixed(1)}</strong>
                <Stars value={summary.avgRating} />
                <span>이용자가 직접 남긴 평점의 평균입니다.</span>
              </>
            ) : (
              <span>평점 정보가 제공되지 않았습니다.</span>
            )}
          </div>
          {writing && user && !alreadyReviewed && (
            <form className="theme-review-form" onSubmit={submit}>
              <fieldset disabled={pending}>
                <label>
                  평점
                  <select name="rating" required defaultValue="5">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}점 {"★".repeat(rating)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  후기
                  <textarea
                    name="content"
                    required
                    rows={3}
                    placeholder="다른 이용자를 위해 스포일러 없이 경험을 나눠 주세요."
                  />
                </label>
                <button className="theme-primary">
                  {pending ? "등록 중…" : "후기 등록"}
                </button>
              </fieldset>
            </form>
          )}
          {!state.items.length && (
            <p className="theme-empty-reviews">
              아직 후기가 없습니다. 첫 번째 후기를 남겨보세요.
            </p>
          )}
          {state.items.map((review) => (
            <article className="theme-review" key={review.id}>
              <span className="theme-avatar" aria-hidden="true">
                {(review.author?.nickname || "익명").slice(0, 1)}
              </span>
              <div className="theme-review-body">
                <div className="theme-review-top">
                  <strong>{review.author?.nickname || "익명"}</strong>
                  <Stars value={review.rating} />
                  <time dateTime={review.createdAt}>
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString("ko-KR")
                      : ""}
                  </time>
                </div>
                <p>{review.content}</p>
                {(isMine(review) || user?.role?.toUpperCase() === "ADMIN") && (
                  <button
                    className="theme-text-button"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setDeleteTarget(review);
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </article>
          ))}
          {totalPages > 1 && (
            <nav className="theme-pagination" aria-label="후기 페이지">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setState((current) => ({ ...current, loading: true }));
                  setPage(page - 1);
                }}
              >
                이전
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setState((current) => ({ ...current, loading: true }));
                  setPage(page + 1);
                }}
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
      {deleteTarget && (
        <div className="theme-delete-confirm" role="alert">
          <p>이 후기를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.</p>
          <button
            className="theme-reset"
            disabled={pending}
            onClick={() => setDeleteTarget(null)}
          >
            취소
          </button>
          <button
            className="theme-danger"
            disabled={pending}
            onClick={removeReview}
          >
            {pending ? "삭제 중…" : "후기 삭제"}
          </button>
        </div>
      )}
    </section>
  );
}

function ThemeDetail({ id }) {
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ loading: true });
  const [summary, setSummary] = useState(null);
  const [retry, setRetry] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getTheme(id, controller.signal)
      .then((theme) => {
        if (!controller.signal.aborted) setState({ theme, loading: false });
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setState({ loading: false, error: themeError(err) });
      });
    return () => controller.abort();
  }, [id, retry, userId]);
  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await deleteTheme(id);
      navigate("/themes", { replace: true });
    } catch (err) {
      setError(themeError(err));
    } finally {
      setPending(false);
    }
  }
  if (state.loading)
    return (
      <div className="theme-page theme-state" role="status">
        테마 정보를 불러오는 중입니다…
      </div>
    );
  if (state.error)
    return (
      <div className="theme-page theme-state" role="alert">
        <p>{state.error}</p>
        <button
          className="theme-reset"
          onClick={() => setRetry((value) => value + 1)}
        >
          다시 시도
        </button>
        <Link to="/themes">테마 목록으로</Link>
      </div>
    );
  const theme = state.theme;
  const ratingInfo = summary ?? theme;
  return (
    <div className="theme-page">
      <Link className="theme-back" to="/themes">
        ‹ 테마 목록으로 돌아가기
      </Link>
      {location.state?.notice && (
        <p role="status" className="theme-notice">
          {location.state.notice}
        </p>
      )}
      <section className="theme-panel">
        <div className="theme-detail-hero">
          <div className="theme-detail-poster">
            <ThemeThumbnail url={theme.thumbnailUrl} />
          </div>
          <div className="theme-detail-main">
            <div className="theme-detail-top">
              <div className="theme-detail-title">
                <span className="theme-count-badge">
                  {theme.genre != "?" ? `${theme.genre}` : "미분류"}
                </span>
                <div className="theme-detail-title-row">
                  <h1>{theme.title}</h1>
                  <BookmarkButton
                    themeId={theme.id}
                    title={theme.title}
                    isBookmarked={theme.isBookmarked}
                    onChange={(isBookmarked) =>
                      setState((current) => ({
                        ...current,
                        theme: { ...current.theme, isBookmarked },
                      }))
                    }
                  />
                </div>
                <p>{theme.storeName || theme.store_name}</p>
                <div className="theme-detail-rating">
                  {ratingInfo.avgRating == null ? (
                    <span>평점 정보를 불러오지 못했습니다.</span>
                  ) : (
                    <>
                      <Stars value={ratingInfo.avgRating} />
                      <strong>{Number(ratingInfo.avgRating).toFixed(1)}</strong>
                      <span>({ratingInfo.reviewCount})</span>
                    </>
                  )}
                </div>
              </div>
              <div className="theme-map-actions">
                <div className="theme-map-card">
                  <ThemeMap
                    key={theme.id}
                    latitude={theme.latitude}
                    longitude={theme.longitude}
                  />
                </div>
                {user?.role?.toUpperCase() === "ADMIN" && (
                  <details className="theme-more">
                    <summary aria-label="테마 관리 메뉴">⋮</summary>
                    <div>
                      <Link to={`/themes/${id}/edit`}>수정</Link>
                      <button onClick={() => setConfirmDelete(true)}>
                        삭제
                      </button>
                    </div>
                  </details>
                )}
              </div>
            </div>
            <dl className="theme-facts">
              {[
                ["주소", theme.address || "정보 없음"],
                ["장르", theme.genre != "?" ? `${theme.genre}` : "미분류"],
                [
                  "권장 인원",
                  theme.minPeople != 0 && theme.maxPeople != 0
                    ? `${theme.minPeople}~${theme.maxPeople}명`
                    : "인원 정보 없음",
                ],
                [
                  "플레이타임",
                  theme.playTime ? `${theme.playTime}분` : "정보 없음",
                ],
                ["난이도", `${theme.difficulty} / 5`],
                [
                  "가격",
                  theme.price != 0
                    ? `1인 ${Number(theme.price).toLocaleString()}원`
                    : "정보 없음",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="theme-detail-buttons">
              <Link
                className="theme-primary"
                to={`/posts?keyword=${encodeURIComponent(theme.title)}`}
              >
                커뮤니티에서 질문하기
              </Link>
            </div>
          </div>
        </div>
        {confirmDelete && (
          <div className="theme-delete-confirm" role="alert">
            <p>
              ‘{theme.title}’ 테마를 삭제하시겠습니까? 삭제 후 복구할 수
              없습니다.
            </p>
            {error && <p className="theme-error">{error}</p>}
            <button
              className="theme-reset"
              disabled={pending}
              onClick={() => setConfirmDelete(false)}
            >
              취소
            </button>
            <button
              className="theme-danger"
              disabled={pending}
              onClick={remove}
            >
              {pending ? "삭제 중…" : "테마 삭제"}
            </button>
          </div>
        )}
        <div className="theme-description">
          <h2>테마 소개</h2>
          <p>{theme.content}</p>
        </div>
      </section>
      <Reviews
        id={id}
        user={user}
        summary={ratingInfo}
        onSummary={setSummary}
      />
    </div>
  );
}

export default function ThemeDetailPage() {
  const { id } = useParams();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [id]);
  return <ThemeDetail key={id} id={id} />;
}
