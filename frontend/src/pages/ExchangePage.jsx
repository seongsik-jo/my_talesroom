import { useState, useEffect, useCallback } from "react";
import {
  fetchItems,
  exchangeItem,
  fetchMyExchanges,
  fetchAllExchanges,
  createItem,
  updateItem,
  deleteItem,
} from "../api/exchangeApi";
import { fetchMyInfo } from "../api/userApi";
import { isLoggedIn, getErrorMessage } from "../api/axiosInstance";
import "../styles/ExchangePage.css";
import useDialog from "../hooks/useDialog";

async function fetchExchangeData() {
  const items = await fetchItems();
  if (!isLoggedIn()) return { items, user: null, history: [], allHistory: [] };

  const user = await fetchMyInfo();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const history = isAdmin ? [] : await fetchMyExchanges();
  const allHistory = isAdmin ? await fetchAllExchanges() : [];

  return { items, user, history, allHistory };
}

function ExchangePage() {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [user, setUser] = useState({
    nickname: "",
    username: "",
    score: 0,
    role: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 관리자 모달 및 폼 상태 (isActive 상태 제거)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    description: "",
    price: "",
    stock: "",
  });

  const CONVERSION_RATE = 10;
  const availablePoints = user.score * CONVERSION_RATE;
  const isAdmin = user.role?.toUpperCase() === "ADMIN";

  const applyData = useCallback(({ items, user, history, allHistory }) => {
    setItems(items);
    setUser(user || { nickname: "", username: "", score: 0, role: "" });
    setMyHistory(history);
    setAllHistory(allHistory);
    setCurrentPage(1);
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchExchangeData();
      applyData(data);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setError(
        getErrorMessage(err, "데이터를 불러오는 중 오류가 발생했습니다."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchExchangeData()
      .then((data) => {
        if (active) applyData(data);
      })
      .catch((err) => {
        if (active)
          setError(
            getErrorMessage(err, "데이터를 불러오는 중 오류가 발생했습니다."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyData]);

  // 교환하기 버튼 클릭 핸들러
  const handleExchangeClick = async (itemId, itemName, price) => {
    if (!isLoggedIn()) {
      await showAlert("로그인이 필요한 서비스입니다.");
      return;
    }

    if (isAdmin) {
      await showAlert("관리자는 상품을 교환할 수 없습니다.");
      return;
    }

    if (availablePoints < price) {
      await showAlert(
        "보유 포인트가 부족합니다! 커뮤니티 활동을 더 열심히 참여해 보세요.",
      );
      return;
    }

    if (
      !(await showConfirm("상품을 교환하시겠습니까?", {
        description: `"${itemName}" 상품을 ${price.toLocaleString()} 포인트로 교환합니다.`,
        confirmText: "교환하기",
      }))
    ) {
      return;
    }

    try {
      await exchangeItem(itemId);
      await showAlert("교환이 완료되었습니다!");
      setLoading(true);
      loadData();
    } catch (err) {
      const errorMsg = getErrorMessage(err, "교환 중 오류가 발생했습니다.");
      await showAlert(errorMsg);
    }
  };

  // --- [관리자 전용 기능: 퀵 재고 조절 (+ / -)] ---
  const handleQuickStockChange = async (item, delta) => {
    const newStock = item.stock + delta;
    if (newStock < 0) {
      await showAlert("재고는 0개 미만으로 떨어질 수 없습니다.");
      return;
    }

    try {
      await updateItem(item.id, {
        name: item.name,
        description: item.description,
        price: item.price,
        stock: newStock,
      });
      loadData();
    } catch (err) {
      await showAlert(getErrorMessage(err, "재고 변경에 실패했습니다."));
    }
  };

  // --- [관리자 모달 핸들러] ---
  const handleOpenCreateModal = () => {
    setEditMode(false);
    setFormData({ id: null, name: "", description: "", price: "", stock: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditMode(true);
    setFormData({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      stock: item.stock,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const { id, name, description, price, stock } = formData;

    if (!name.trim() || price === '' || stock === '') {
      await showAlert('상품명, 가격, 재고는 필수 입력 항목입니다.');
      return;
    }

    if (Number(price) <= 0 || Number(stock) < 0) {
      await showAlert('가격은 1P 이상, 재고는 0개 이상으로 입력해 주세요.');
      return;
    }

    const payload = {
      name: name.trim(),
      description,
      price: Number(price),
      stock: Number(stock),
    };

    try {
      if (editMode) {
        await updateItem(id, payload);
        await showAlert("상품이 성공적으로 수정되었습니다.");
      } else {
        await createItem(payload);
        await showAlert("상품이 성공적으로 등록되었습니다.");
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      await showAlert(getErrorMessage(err, "요청 처리에 실패했습니다."));
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (
      !(await showConfirm("상품 삭제", {
        description: `"${itemName}" 상품을 정말 삭제하시겠습니까?`,
        confirmText: "삭제하기",
      }))
    ) {
      return;
    }

    try {
      await deleteItem(itemId);
      await showAlert("상품이 삭제되었습니다.");
      loadData();
    } catch (err) {
      await showAlert(getErrorMessage(err, "상품 삭제에 실패했습니다."));
    }
  };

  if (loading) return <div className="exchange-loading">로딩 중...</div>;
  if (error) return <div className="exchange-error">{error}</div>;

  return (
    <div className="exchange-page">
      <header className="exchange-page__header">
        <div className="exchange-page__header-content">
          <div>
            <p className="exchange-page__eyebrow">POINT EXCHANGE</p>
            <h1 className="exchange-page__title">포인트 교환소</h1>
            <p className="exchange-page__description">
              커뮤니티 활동 점수로 상품을 교환할 수 있어요. (1점 = 10P)
            </p>
          </div>
          {isLoggedIn() && isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="exchange-page__admin-register-btn"
            >
              + 상품 등록
            </button>
          )}
        </div>
      </header>

      {isLoggedIn() && !isAdmin && (
        <div className="exchange-banner">
          <div className="exchange-banner__stats">
            <div className="exchange-banner__stat-item">
              <span className="exchange-banner__label">내 활동 점수</span>
              <span className="exchange-banner__score-value">
                {user.score.toLocaleString()} 점
              </span>
            </div>
            <div className="exchange-banner__divider"></div>
            <div className="exchange-banner__stat-item">
              <span className="exchange-banner__label">사용 가능 포인트</span>
              <span className="exchange-banner__point-value">
                {availablePoints.toLocaleString()} P
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 교환 가능한 상품 목록 */}
      <section className="exchange-section">
        <h3 className="exchange-section__title">
          {isAdmin ? "상품 관리 목록 (관리자 뷰)" : "교환 가능한 상품"}
        </h3>
        <div className="exchange-grid">
          {items.map((item) => {
            const isAffordable = availablePoints >= item.price;
            const isSoldOut = item.stock <= 0;

            return (
              <div
                key={item.id}
                className={`exchange-card ${isSoldOut ? "sold-out" : ""}`}
              >
                <div>
                  <div className="exchange-card__header-row">
                    <h4 className="exchange-card__name">{item.name}</h4>
                  </div>
                  <p className="exchange-card__desc">{item.description}</p>
                </div>

                <div className="exchange-card__footer">
                  <div className="exchange-card__price-info">
                    <span className="exchange-card__price">
                      {item.price.toLocaleString()} P
                    </span>

                    {/* 퀵 재고 조절 위젯 (관리자 전용) */}
                    {isAdmin ? (
                      <div className="exchange-quick-stock">
                        <span className="exchange-card__stock">
                          재고: <strong>{item.stock}</strong>
                        </span>
                        <div className="exchange-quick-btns">
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(item, -1)}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStockChange(item, +1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="exchange-card__stock">
                        재고: {item.stock}개
                      </span>
                    )}
                  </div>

                  {/* 일반 사용자용 교환 버튼 */}
                  {!isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        handleExchangeClick(item.id, item.name, item.price)
                      }
                      disabled={isSoldOut || (isLoggedIn() && !isAffordable)}
                      className="exchange-card__button"
                    >
                      {isSoldOut
                        ? "품절"
                        : !isAffordable && isLoggedIn()
                          ? "포인트 부족"
                          : "교환하기"}
                    </button>
                  )}

                  {/* 관리자 액션 버튼들 (수정, 삭제) */}
                  {isLoggedIn() && isAdmin && (
                    <div className="exchange-card__admin-actions">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="exchange-card__admin-btn exchange-card__admin-btn--edit"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="exchange-card__admin-btn exchange-card__admin-btn--delete"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 교환 내역 섹션 */}
      <section className="history-section">
        <div className="history-header-row">
          <h3 className="exchange-section__title history-title">
            {isAdmin ? `전체 유저 교환 내역 (${allHistory.length}건)` : `나의 교환 내역 (${myHistory.length}건)`}
          </h3>
        </div>

        {!isLoggedIn() ? (
          <p className="history-login-guide">로그인 후 교환 내역을 확인하실 수 있습니다.</p>
        ) : (() => {
          const targetList = isAdmin ? allHistory : myHistory;
          const totalPages = Math.ceil(targetList.length / ITEMS_PER_PAGE);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const currentItems = targetList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          if (targetList.length === 0) {
            return (
              <p className="history-empty">
                {isAdmin ? '전체 교환 내역이 없습니다.' : '아직 교환한 상품이 없습니다.'}
              </p>
            );
          }

          return (
            <>
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      {isAdmin && <th>유저 ID</th>}
                      <th>상품명</th>
                      <th>사용 포인트</th>
                      <th>교환 일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((h) => {
                      const productName = h.itemName || h.item_name || h.Item?.name || '상품 정보 없음';
                      return (
                        <tr key={h.id}>
                          {isAdmin && <td className="history-table__user"><strong>{h.userId || h.user_id}</strong></td>}
                          <td className="history-table__name">{productName}</td>
                          <td className="history-table__points">-{(h.usedPoints ?? h.used_points ?? 0).toLocaleString()} P</td>
                          <td className="history-table__date">{new Date(h.createdAt || h.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="history-pagination">
                  <button
                    type="button"
                    className="history-pagination__btn"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    이전
                  </button>

                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`history-pagination__btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="history-pagination__btn"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* 상품 등록 / 수정 모달 */}
      {isModalOpen && (
        <div className="exchange-modal-overlay">
          <div className="exchange-modal">
            <h3 className="exchange-modal__title">
              {editMode ? "상품 수정" : "상품 등록"}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="exchange-modal__form-group">
                <label className="exchange-modal__label">상품명</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="상품 이름을 입력하세요"
                  className="exchange-modal__input"
                />
              </div>
              <div className="exchange-modal__form-group">
                <label className="exchange-modal__label">설명</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="상품 설명을 입력하세요"
                  rows="3"
                  className="exchange-modal__textarea"
                />
              </div>
              <div className="exchange-modal__form-group">
                <label className="exchange-modal__label">가격 (포인트)</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  placeholder="필요 포인트 입력"
                  className="exchange-modal__input"
                />
              </div>
              <div className="exchange-modal__form-group">
                <label className="exchange-modal__label">초기 재고 수량</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleFormChange}
                  placeholder="재고 수량 입력"
                  className="exchange-modal__input"
                />
              </div>

              <div className="exchange-modal__buttons">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="exchange-modal__btn exchange-modal__btn--cancel"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="exchange-modal__btn exchange-modal__btn--submit"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExchangePage;
