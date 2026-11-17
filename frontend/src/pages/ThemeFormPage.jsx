import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createTheme,
  getTheme,
  themeError,
  updateTheme,
} from "../api/themeApi";
import useAuth from "../hooks/useAuth";
import "../styles/ThemePages.css";

const THEME_GENRES = [
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
];

export default function ThemeFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    theme: null,
    loadedId: null,
    error: "",
  });
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [retry, setRetry] = useState(0);
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  useEffect(() => {
    if (!id || !isAdmin) return;
    const controller = new AbortController();
    getTheme(id, controller.signal)
      .then((theme) => setState({ theme, loadedId: id, error: "" }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ theme: null, loadedId: id, error: themeError(error) });
      });
    return () => controller.abort();
  }, [id, isAdmin, retry]);
  const back = id ? `/themes/${id}` : "/themes";
  if (!isAdmin)
    return (
      <div className="theme-page">
        <div className="theme-panel theme-state">
          <h1>관리자만 접근할 수 있습니다.</h1>
          <Link to={user ? "/themes" : "/login"}>
            {user ? "테마 목록으로" : "로그인하기"}
          </Link>
        </div>
      </div>
    );
  if (id && state.loadedId !== id)
    return (
      <div className="theme-page theme-state" role="status">
        테마 정보를 불러오는 중입니다…
      </div>
    );
  if (state.error)
    return (
      <div className="theme-page theme-state" role="alert">
        <p>{state.error}</p>
        <button onClick={() => setRetry((value) => value + 1)}>
          다시 시도
        </button>
        <Link to="/themes">테마 목록</Link>
      </div>
    );
  const theme = state.theme || {};

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    Object.keys(values).forEach((key) => {
      values[key] = values[key].trim();
    });
    for (const key of [
      "minPeople",
      "maxPeople",
      "playTime",
      "difficulty",
      "price",
    ])
      values[key] = Number(values[key]);
    for (const key of ["latitude", "longitude"])
      values[key] = values[key] === "" ? null : Number(values[key]);
    values.thumbnailUrl = values.thumbnailUrl || null;
    if (
      !Number.isInteger(values.minPeople) ||
      !Number.isInteger(values.maxPeople) ||
      values.minPeople < 2 ||
      values.minPeople > 20 ||
      values.maxPeople < values.minPeople ||
      values.maxPeople > 20
    )
      return setSubmitError(
        "인원은 2명 이상 20명 이하로 입력하고, 최대 인원은 최소 인원 이상으로 설정해 주세요.",
      );
    if (!THEME_GENRES.includes(values.genre))
      return setSubmitError("올바른 장르를 선택해 주세요.");
    if (
      ["title", "storeName", "address", "genre", "content"].some(
        (key) => !values[key],
      )
    )
      return setSubmitError("필수 항목을 입력해 주세요.");
    setPending(true);
    setSubmitError("");
    try {
      const result = id
        ? await updateTheme(id, values)
        : await createTheme(values);
      navigate(`/themes/${id || result.id}`, {
        replace: true,
        state: {
          notice: id ? "테마가 수정되었습니다." : "테마가 등록되었습니다.",
        },
      });
    } catch (error) {
      setSubmitError(themeError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="theme-page">
      <div className="theme-page-heading">
        <div>
          <p className="theme-eyebrow">ADMIN · THEME</p>
          <h1>테마 {id ? "수정" : "등록"}</h1>
          <p className="theme-subtitle">
            매장과 테마의 기본 정보를 관리합니다.
          </p>
        </div>
      </div>
      <form
        key={id || "new"}
        className="theme-panel theme-edit-form"
        onSubmit={submit}
      >
        <fieldset disabled={pending}>
          <div className="theme-form-grid">
            {[
              ["title", "테마명", 150, "테마명을 입력해 주세요"],
              ["storeName", "매장", 100, "매장명을 입력해 주세요"],
              ["address", "주소", 255, "매장의 도로명 또는 지번 주소"],
            ].map(([name, label, maxLength, placeholder]) => (
              <label key={name}>
                {label} *
                <input
                  name={name}
                  required
                  maxLength={maxLength}
                  placeholder={placeholder}
                  defaultValue={
                    theme[name] ??
                    (name === "storeName" ? theme.store_name : "") ??
                    ""
                  }
                />
              </label>
            ))}
            <label>
              장르 *
              <select name="genre" required defaultValue={theme.genre ?? ""}>
                <option value="" disabled>
                  장르를 선택해 주세요
                </option>
                {THEME_GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["minPeople", "최소 인원", 2, 20, 2],
              ["maxPeople", "최대 인원", 2, 20, 4],
              ["playTime", "플레이타임 (분)", 1, undefined, 60],
            ].map(([name, label, min, max, value]) => (
              <label key={name}>
                {label} *
                <input
                  name={name}
                  type="number"
                  step="1"
                  required
                  min={min}
                  max={max}
                  defaultValue={theme[name] ?? value}
                  onInput={
                    max
                      ? (event) => {
                          if (Number(event.currentTarget.value) > max)
                            event.currentTarget.value = String(max);
                        }
                      : undefined
                  }
                />
              </label>
            ))}
            <label>
              난이도 (1~5) *
              <select
                name="difficulty"
                required
                defaultValue={theme.difficulty ?? ""}
              >
                <option value="" disabled>
                  난이도를 선택해 주세요
                </option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              가격 (원 / 1인) *
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={theme.price ?? ""}
                placeholder="예: 25000"
              />
            </label>
            <label>
              위도 · Y좌표 (선택)
              <input
                name="latitude"
                type="number"
                min="-90"
                max="90"
                step="0.0000001"
                placeholder="예: 37.5665"
                defaultValue={theme.latitude ?? ""}
              />
            </label>
            <label>
              경도 · X좌표 (선택)
              <input
                name="longitude"
                type="number"
                min="-180"
                max="180"
                step="0.0000001"
                placeholder="예: 126.9780"
                defaultValue={theme.longitude ?? ""}
              />
            </label>
            <label className="theme-form-wide">
              썸네일 URL (선택)
              <input
                name="thumbnailUrl"
                type="url"
                maxLength={2048}
                placeholder="https://…"
                defaultValue={theme.thumbnailUrl ?? ""}
              />
            </label>
            <label className="theme-form-wide">
              테마 설명 *
              <textarea
                name="content"
                required
                rows={5}
                placeholder="테마의 줄거리와 특징을 입력해 주세요"
                defaultValue={theme.content ?? ""}
              />
            </label>
          </div>
          {submitError && (
            <p role="alert" className="theme-error">
              {submitError}
            </p>
          )}
          <div className="theme-form-actions">
            <button
              type="button"
              className="theme-reset"
              onClick={() => navigate(back)}
            >
              취소
            </button>
            <button className="theme-primary">
              {pending ? "저장 중…" : id ? "수정 저장" : "테마 등록"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
