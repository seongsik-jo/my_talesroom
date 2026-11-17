const { DataTypes } = require('sequelize');     // 컬럼 타입 도구
const sequelize = require('../config/db');      // DB 연결 객체

const User = sequelize.define('User', {
    id: {
        type: DataTypes.STRING(100),            // users.id는 숫자가 아니라 로그인 아이디 문자열 (예: 'test01')
        primaryKey: true,                       // 기본키. autoIncrement는 없어요 
    },
    password: {
        type: DataTypes.STRING(255),            // bcrypt로 암호화된 비밀번호
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,                           // 같은 이메일 중복 불가
    },
    role: {
        type: DataTypes.STRING(20),             // 'ADMIN' = 관리자 인지 아닌지로 관리 관리자가 아니라면 일반 회원
    },
    nickname: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,                           // 같은 닉네임 중복 불가
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0 // 기본 활동 점수 0점
    },
    grade: {
        type: DataTypes.STRING(20),
        defaultValue: '방린이'   // 기본 등급
    },
}, {
    tableName: 'users',                         // 실제 테이블 이름
    underscored: true,                          // createdAt <-> created_at 자동 변환
    timestamps: true,                           // created_at, updated_at 자동 관리
});

module.exports = User;