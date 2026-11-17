// 관리자 확인 middleware, 반드시 authMiddleware 다음에 위치

function adminMiddleware(req, res, next) {
    if (req.user?.role?.toUpperCase() !== 'ADMIN') {
        return res.status(403).json({ success: false, data:null, message: '관리자만 접근할 수 있습니다.'}) // 403 : 권한이 없음
    }
    next();
}

module.exports = adminMiddleware; 