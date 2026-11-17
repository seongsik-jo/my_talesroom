// 게시글 작성(P-03) / 수정(P-04) 화면 — 한 파일로 두 화면을 처리해요
// 주소 /posts/new → 작성 모드, /posts/:id/edit → 수정 모드 (주소에 id가 있는지로 구분)
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createPost, fetchPost, updatePost } from "../api/postApi";
import { getErrorMessage, getStoredUser, isLoggedIn } from "../api/axiosInstance";
import { CATEGORIES } from "../utils/postFormat";
import "../styles/PostFormPage.css";
import useDialog from "../hooks/useDialog";

const TITLE_MAX = 100; // 제목 최대 글자 수
const CONTENT_MAX = 5000; // 내용 최대 글자 수 (화면의 "0 / 5,000자")

// 폼 처음 값 (작성 모드)
const EMPTY_FORM = { category: "", title: "", content: "", isSpoiler: false, isNotice: false };

function PostFormPage() {
  const { id } = useParams(); // 주소의 :id 꺼내기. 작성 모드면 undefined
  const isEdit = Boolean(id); // id가 있으면 수정 모드
  const navigate = useNavigate();
  const { showAlert } = useDialog();
  const isAdmin = getStoredUser()?.role?.toUpperCase() === "ADMIN"; // 관리자만 "공지 등록" 체크박스 보이기

  const [form, setForm] = useState(EMPTY_FORM); // 입력값 전체를 객체 하나로 관리
  const [errors, setErrors] = useState({}); // 칸별 에러 { title: "제목을 입력해 주세요." }
  const [submitError, setSubmitError] = useState(""); // 서버 에러 (폼 아래 한 줄)
  const [submitting, setSubmitting] = useState(false); // 등록 중 → 버튼 잠금 (두 번 클릭 방지)
  const [loading, setLoading] = useState(isEdit); // 수정 모드면 기존 글 불러오는 동안 true

  // 비로그인으로 주소를 직접 쳐서 들어오면 로그인 화면으로 보내기
  useEffect(() => {
    if (!isLoggedIn()) navigate("/login", { replace: true });
  }, [navigate]);

  // 수정 모드: 기존 글을 불러와서 폼에 채우기
  useEffect(() => {
    if (!isEdit) return; // 작성 모드면 할 일 없음
    let active = true;
    fetchPost(id)
      .then(async (post) => {
        if (!active) return;
        // 작성자가 아니면 수정 불가 (서버도 막지만 화면에서도 미리 돌려보내기)
        // 상세 API의 isMine은 지금 항상 false라서(로그인 정보를 안 읽음), 작성자 id와 내 id를 직접 비교해요
        const authorId = post.author?.id ?? post.author?.userId; // 상세는 id, 목록은 userId로 와요
        if (authorId !== getStoredUser()?.id) {
          await showAlert("작성자만 수정할 수 있어요.");
          if (active) navigate("/posts", { replace: true }); // 목록으로 돌려보내기
          return;
        }
        // 서버 값 중 폼에 필요한 것만 골라 넣기
        setForm({
          category: post.category,
          title: post.title,
          content: post.content,
          isSpoiler: Boolean(post.isSpoiler), // 0/1이 와도 true/false로 변환
          isNotice: Boolean(post.isNotice),
        });
      })
      .catch((err) => { if (active) setSubmitError(getErrorMessage(err, "글을 불러오지 못했어요.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, isEdit, navigate, showAlert]); // 이 값이 바뀌면 다시 불러오기

  // 입력 공통 처리: name 속성으로 어떤 칸인지 구분해서 그 값만 바꿔요
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target; // 이벤트가 난 input의 정보
    // 체크박스는 checked(true/false), 나머지는 value(글자)
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    // 다시 입력하기 시작하면 그 칸의 에러 문구는 지우기
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // 카테고리 칩 클릭 (input이 아니라 버튼이라 따로 처리)
  const handleCategory = (value) => {
    setForm((prev) => ({ ...prev, category: value }));
    setErrors((prev) => ({ ...prev, category: "" }));
  };

  // 제출 전 검사: 문제가 있는 칸만 에러 문구를 담아서 돌려줘요
  const validate = () => {
    const next = {};
    if (!form.category) next.category = "카테고리를 선택해 주세요.";
    if (!form.title.trim()) next.title = "제목을 입력해 주세요."; // 공백만 있는 것도 막기
    else if (form.title.length > TITLE_MAX) next.title = `제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`;
    if (!form.content.trim()) next.content = "내용을 입력해 주세요.";
    else if (form.content.length > CONTENT_MAX) next.content = `내용은 ${CONTENT_MAX.toLocaleString()}자 이하로 입력해 주세요.`;
    return next;
  };

  // 등록/수정 버튼
  const handleSubmit = async (e) => {
    e.preventDefault(); // form 기본 동작(새로고침) 막기
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return; // 에러가 하나라도 있으면 중단 (입력값은 그대로 유지)

    setSubmitting(true);
    setSubmitError("");
    // 서버에 보낼 본문. 관리자가 아니면 isNotice는 항상 false
    const body = { ...form, title: form.title.trim(), isNotice: isAdmin ? form.isNotice : false };
    try {
      // 작성이면 POST, 수정이면 PUT. 둘 다 { id }를 돌려줘요
      if (isEdit) await updatePost(id, body); // PUT /api/posts/:id
      else await createPost(body); // POST /api/posts
      // 상세 화면(P-02)은 다른 팀원 담당이라 아직 프론트에 없어서, 일단 목록으로 이동해요
      // 상세 화면이 생기면 → navigate(`/posts/${결과 id}`)로 바꾸면 돼요
      navigate("/posts", { replace: true }); // replace: 뒤로가기로 폼에 다시 안 돌아오게
    } catch (err) {
      // 로그인 만료(401)면 로그인 화면으로
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setSubmitError(getErrorMessage(err, "저장하지 못했어요. 다시 시도해 주세요."));
      setSubmitting(false); // 다시 누를 수 있게
    }
  };

  if (loading) return <div className="post-form__loading">글을 불러오는 중이에요…</div>;

  return (
    <div className="post-form">
      <p className="post-form__eyebrow">COMMUNITY</p>
      <h1 className="post-form__title">{isEdit ? "글 수정" : "글쓰기"}</h1>

      {/* noValidate: 브라우저 기본 경고 말고 우리가 만든 에러 문구를 쓰기 */}
      <form className="post-form__card" onSubmit={handleSubmit} noValidate>
        {/* 카테고리 */}
        <div className="post-form__field">
          <span className="post-form__label">카테고리 <em>*</em></span>
          <div className="post-form__chips" role="radiogroup" aria-label="카테고리">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button" // form 안 버튼은 기본이 submit이라 꼭 button으로
                role="radio"
                aria-checked={form.category === c.value}
                className={`post-form__chip ${form.category === c.value ? "is-active" : ""}`}
                onClick={() => handleCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {errors.category && <p className="post-form__error">{errors.category}</p>}
        </div>

        {/* 제목 */}
        <div className="post-form__field">
          {/* htmlFor ↔ id 연결: 라벨을 눌러도 입력창에 커서가 가요 */}
          <label className="post-form__label" htmlFor="post-title">제목 <em>*</em></label>
          <input
            id="post-title"
            name="title" // handleChange가 이 이름으로 form.title을 바꿔요
            className={`post-form__input ${errors.title ? "has-error" : ""}`}
            value={form.title}
            onChange={handleChange}
            maxLength={TITLE_MAX}
            placeholder="제목을 입력해 주세요"
          />
          {errors.title && <p className="post-form__error">{errors.title}</p>}
        </div>

        {/* 내용 + 글자 수 */}
        <div className="post-form__field">
          <label className="post-form__label" htmlFor="post-content">내용 <em>*</em></label>
          <textarea
            id="post-content"
            name="content"
            className={`post-form__textarea ${errors.content ? "has-error" : ""}`}
            value={form.content}
            onChange={handleChange}
            maxLength={CONTENT_MAX}
            placeholder="자유롭게 이야기를 나눠 주세요"
            rows={12}
          />
          <div className="post-form__row">
            {errors.content ? <p className="post-form__error">{errors.content}</p> : <span />}
            {/* toLocaleString(): 5000 → "5,000" */}
            <span className="post-form__count">{form.content.length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}자</span>
          </div>
        </div>

        {/* 스포일러 */}
        <label className="post-form__check">
          <input type="checkbox" name="isSpoiler" checked={form.isSpoiler} onChange={handleChange} />
          <span>스포일러 포함 <small>(열람 전에 경고 표시)</small></span>
        </label>

        {/* 공지: 관리자에게만 보여요 */}
        {isAdmin && (
          <label className="post-form__check">
            <input type="checkbox" name="isNotice" checked={form.isNotice} onChange={handleChange} />
            <span>공지사항으로 등록</span>
            <span className="post-form__admin-chip">관리자 전용</span>
          </label>
        )}

        {/* 서버 에러 */}
        {submitError && <p className="post-form__submit-error">{submitError}</p>}

        {/* 버튼 */}
        <div className="post-form__actions">
          <button type="button" className="post-form__cancel" onClick={() => navigate(-1)} disabled={submitting}>
            취소
          </button>
          <button type="submit" className="post-form__submit" disabled={submitting}>
            {submitting ? "저장 중…" : isEdit ? "수정 완료" : "게시글 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PostFormPage;
