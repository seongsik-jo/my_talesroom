// 관리자 회원 목록 화면 (M-04) — 주소: /admin/users
// 관리자(ADMIN)만 볼 수 있고, 회원을 가입일 최신순으로 10명씩 보여줘요
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchUsers } from "../api/adminApi";
import { getErrorMessage } from "../api/axiosInstance";
import { formatDate } from "../utils/postFormat"; // "2026-11-09T..." → "2026.11.09"
import useAuth from "../hooks/useAuth"; // 팀원이 만든 로그인 상태 훅
import Pagination from "../components/Pagination";
import "../styles/AdminUsersPage.css";

const PAGE_SIZE = 10; // 한 페이지 10명

function AdminUsersPage() {
  const { user, isLoggedIn } = useAuth(); // 로그인 여부와 내 정보 { id, nickname, role }
  const isAdmin = user?.role?.toUpperCase() === "ADMIN"; // 관리자인지
  const [searchParams, setSearchParams] = useSearchParams(); // 주소창 ?page= 읽기/쓰기
  const page = Number(searchParams.get("page")) || 1; // 없으면 1페이지

  const [data, setData] = useState(null); // 서버 응답 { items, totalCount, totalPages }
  const [loading, setLoading] = useState(true); // 불러오는 중 → 스켈레톤
  const [error, setError] = useState(""); // 에러 문구

  // 페이지가 바뀔 때마다 서버에서 다시 불러오기
  useEffect(() => {
    if (!isAdmin) return; // 관리자가 아니면 요청 자체를 안 보내요 (아래에서 안내 화면 표시)
    let ignore = false; // 페이지를 빨리 넘길 때 늦게 온 이전 응답을 무시하는 깃발
    setLoading(true);
    setError("");
    fetchUsers({ page, size: PAGE_SIZE })
      .then((result) => { if (!ignore) setData(result); }) // 성공 → 표 데이터 교체
      .catch((err) => { if (!ignore) setError(getErrorMessage(err, "회원 목록을 불러오지 못했어요.")); }) // 401·403 문구도 그대로 표시
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; }; // 다음 요청이 시작되면 이번 결과는 버림
  }, [page, isAdmin]);

  // 페이지 번호 클릭 → 주소의 page 바꾸기 (그러면 위 useEffect가 다시 실행)
  const handlePage = (n) => {
    setSearchParams(n === 1 ? {} : { page: String(n) }); // 1페이지면 ?page 없이 깔끔하게
    window.scrollTo({ top: 0, behavior: "smooth" }); // 맨 위로
  };

  // 로그인 안 했거나 관리자가 아니면 표 대신 안내 (서버도 401/403으로 막지만 화면에서 먼저 안내)
  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="admin-users">
        <div className="admin-users__denied">
          <p className="admin-users__denied-title">관리자만 볼 수 있는 페이지예요.</p>
          {/* 로그인 안 했으면 로그인으로, 했으면 홈으로 */}
          <Link to={isLoggedIn ? "/" : "/login"} className="admin-users__denied-link">
            {isLoggedIn ? "홈으로 가기" : "로그인하기"}
          </Link>
        </div>
      </div>
    );
  }

  const items = data?.items ?? []; // 데이터가 아직 없으면 빈 배열

  return (
    <div className="admin-users">
      {/* 제목 영역 */}
      <Link to="/mypage" className="admin-users__back">
        <span aria-hidden="true">‹</span> 마이페이지로 돌아가기
      </Link>
      <p className="admin-users__eyebrow">ADMIN</p>
      <h1 className="admin-users__title">회원 관리</h1>
      <p className="admin-users__subtitle">
        {/* 전체 회원 수: toLocaleString()으로 1,234처럼 쉼표 */}
        전체 회원 <strong>{data ? data.totalCount.toLocaleString() : "-"}</strong>명
      </p>

      <div className="admin-users__card">
        {error ? (
          <div className="admin-users__state">{error}</div>
        ) : (
          // 표: 화면이 좁으면 가로 스크롤 (wrap이 overflow-x: auto)
          <div className="admin-users__table-wrap">
            <table className="admin-users__table">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>닉네임</th>
                  <th>이메일</th>
                  <th>권한</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? // 로딩 중: 회색 막대 5줄 (칸 5개)
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }, (__, j) => (
                          <td key={j}><span className="admin-users__skeleton" /></td>
                        ))}
                      </tr>
                    ))
                  : items.length === 0
                  ? // 회원이 한 명도 없을 때: colSpan=5 → 한 칸이 5칸 너비를 차지
                    <tr><td colSpan={5} className="admin-users__state">가입한 회원이 없어요.</td></tr>
                  : items.map((u) => (
                      <tr key={u.userId}>
                        <td className="admin-users__id">{u.userId}</td>
                        <td>{u.nickname}</td>
                        <td className="admin-users__muted">{u.email}</td>
                        {/* 권한 배지: ADMIN은 진한 색, USER는 연한 색 */}
                        <td>
                          <span className={`admin-users__role ${u.role?.toUpperCase() === "ADMIN" ? "is-admin" : ""}`}>
                            {u.role?.toUpperCase() === "ADMIN" ? "관리자" : "회원"}
                          </span>
                        </td>
                        <td className="admin-users__muted">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지 번호 (커뮤니티와 같은 공용 컴포넌트) */}
      {!loading && !error && <Pagination page={page} totalPages={data?.totalPages} onChange={handlePage} />}
    </div>
  );
}

export default AdminUsersPage;
