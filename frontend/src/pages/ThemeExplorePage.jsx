import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getThemes } from "../api/themeApi";
import useAuth from "../hooks/useAuth";
import SearchAutocomplete from "../components/SearchAutocomplete";
import ThemeThumbnail from "../components/ThemeThumbnail";
import BookmarkButton from "../components/BookmarkButton";
import "../styles/ThemeExplorePage.css";

const regions = ["서울", "홍대", "강남", "건대", "잠실", "신촌", "대학로"];
const genres = [
  "호러/공포",
  "추리",
  "드라마",
  "스릴러",
  "미스터리",
  "판타지",
  "SF",
  "잠입",
  "감성",
  "모험/탐험",
  "코미디",
  "타임어택",
  "범죄",
  "야외",
  "?",
];
const size = 6;

export default function ThemeExplorePage() {
  const { user } = useAuth();
  const userId = user?.id ?? user?.userId;
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({
    loading: true,
    items: [],
    totalCount: 0,
    totalPages: 0,
  });
  const [retry, setRetry] = useState(0);
  const queryString = params.toString();
  const rawPage = Number(params.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(queryString);
    getThemes(
      {
        keyword: query.get("keyword") || "",
        region: query.get("region") || "",
        people: query.get("people") || "",
        genre: query.get("genre") || "",
        sort: query.get("sort") || "latest",
        page,
        size,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setState({ ...result, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            items: [],
            totalCount: 0,
            totalPages: 0,
            error:
              error.response?.data?.message ||
              (error.response
                ? "테마를 불러오지 못했습니다. 서버 연결을 확인하고 다시 시도해 주세요."
                : error.message),
          });
      });
    return () => controller.abort();
  }, [queryString, page, retry, userId]);

  function update(values) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (!Object.hasOwn(values, "page")) next.delete("page");
    if (next.toString() === params.toString()) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    setParams(next);
  }
  function reset() {
    update(Object.fromEntries([...params.keys()].map((key) => [key, ""])));
  }
  const start = Math.max(1, Math.min(page - 2, state.totalPages - 4));
  const pages = Array.from(
    { length: Math.min(5, state.totalPages) },
    (_, i) => start + i,
  );

  return (
    <div className="theme-explore">
      <section className="theme-page-heading">
        <div>
          <p className="theme-eyebrow">THEME EXPLORE</p>
          <h1>테마 탐색</h1>
          <p className="theme-subtitle">
            내 취향과 조건에 맞는 방탈출 테마를 찾아보세요.
          </p>
        </div>
        <div className="theme-heading-actions">
          {user?.role?.toUpperCase() === "ADMIN" && (
            <Link className="theme-admin-button" to="/themes/new">
              ＋ 테마 등록
            </Link>
          )}
        </div>
      </section>
      <form
        key={params.get("keyword") || ""}
        className="theme-filters"
        onSubmit={(event) => {
          event.preventDefault();
          update({
            keyword: new FormData(event.currentTarget).get("keyword").trim(),
          });
        }}
      >
        <div className="theme-search-row">
          <div className="theme-search-field">
            <SearchAutocomplete
              type="themes"
              name="keyword"
              initialValue={params.get("keyword") || ""}
              placeholder="테마명을 검색해 보세요"
              ariaLabel="테마명 검색"
              onSelect={(title) => {
                update({ keyword: title });
              }}
            />
            <button
              type="submit"
              className="theme-search-icon"
              aria-label="테마 검색"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            </button>
          </div>
          <button className="theme-primary">검색</button>
        </div>
        <div className="theme-filter-row">
          {[
            ["region", "지역", regions.map((value) => [value, value])],
            [
              "people",
              "인원수",
              Array.from({ length: 8 }, (_, i) => [
                String(i + 1),
                `${i + 1}명`,
              ]),
            ],
            ["genre", "장르", genres.map((value) => [value, value])],
          ].map(([name, label, options]) => (
            <select
              key={name}
              aria-label={label}
              value={params.get(name) || ""}
              onChange={(event) => update({ [name]: event.target.value })}
            >
              <option value="">{label}</option>
              {options.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          ))}
          <button
            type="button"
            className="theme-reset"
            onClick={(event) => {
              event.currentTarget.form.reset();
              reset();
            }}
          >
            ↺ 초기화
          </button>
        </div>
      </form>
      <section aria-label="테마 검색 결과" aria-busy={state.loading}>
        <div className="theme-results-heading">
          <h2>
            {["keyword", "region", "people", "genre"].some((key) =>
              params.get(key),
            )
              ? "검색 결과"
              : "전체 테마"}{" "}
            <span>
              {state.loading ? "…" : state.totalCount.toLocaleString()}
            </span>
          </h2>
          <select
            aria-label="정렬"
            value={params.get("sort") || "latest"}
            onChange={(event) => update({ sort: event.target.value })}
          >
            <option value="latest">최신순</option>
            <option value="rating">평점순</option>
            <option value="reviews">후기 많은순</option>
          </select>
        </div>
        {state.loading ? (
          <div className="theme-state" role="status">
            테마를 불러오고 있습니다…
          </div>
        ) : state.error ? (
          <div className="theme-state" role="alert">
            <p>{state.error}</p>
            <button
              className="theme-primary"
              onClick={() => {
                setState((current) => ({ ...current, loading: true }));
                setRetry((value) => value + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        ) : !state.items.length ? (
          <div className="theme-state">
            <h3>조건에 맞는 테마가 없습니다.</h3>
            <p>검색어나 필터를 변경해 보세요.</p>
            <button className="theme-reset" onClick={reset}>
              전체 테마 보기
            </button>
          </div>
        ) : (
          <div className="theme-grid">
            {state.items.map((theme) => (
              <div key={theme.id} className="theme-card-shell">
                <Link
                  className="theme-card"
                  to={`/themes/${theme.id}`}
                  aria-label={`${theme.title} 상세 보기`}
                >
                  <div className="theme-artwork">
                    <ThemeThumbnail url={theme.thumbnailUrl} />
                    <span className="theme-genre-badge">
                      {theme.genre && theme.genre !== "?"
                        ? theme.genre
                        : "미분류"}
                    </span>
                  </div>
                  <div className="theme-card-content">
                    <h3>{theme.title}</h3>
                    <p>
                      {[
                        theme.region || theme.storeName || theme.store_name,
                        theme.minPeople != 0 && theme.maxPeople != 0
                          ? `${theme.minPeople}~${theme.maxPeople}명`
                          : "인원 정보 없음",
                        theme.playTime ? `${theme.playTime}분` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="theme-card-bottom">
                      <span className="theme-rating">
                        <span aria-hidden="true">★</span>{" "}
                        {Number(theme.avgRating || 0).toFixed(1)}{" "}
                        <small>
                          ({Number(theme.reviewCount || 0).toLocaleString()})
                        </small>
                      </span>
                      <span className="theme-difficulty">
                        난이도 {theme.difficulty}/5
                      </span>
                    </div>
                  </div>
                </Link>
                <BookmarkButton
                  themeId={theme.id}
                  title={theme.title}
                  isBookmarked={theme.isBookmarked}
                  onChange={(isBookmarked) =>
                    setState((current) => ({
                      ...current,
                      items: current.items.map((item) =>
                        item.id === theme.id ? { ...item, isBookmarked } : item,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        {!state.loading && !state.error && state.totalPages > 1 && (
          <nav className="theme-pagination" aria-label="테마 페이지">
            <button
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {pages.map((number) => (
              <button
                key={number}
                aria-current={page === number ? "page" : undefined}
                onClick={() => update({ page: String(number) })}
              >
                {number}
              </button>
            ))}
            <button
              disabled={page >= state.totalPages}
              onClick={() => update({ page: String(page + 1) })}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
