
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');

// backend의 DB 환경변수 사용
dotenv.config({
  path: path.join(__dirname, '../backend/.env')
});

// 기존 Sequelize 모델 재사용
const { sequelize, Theme } = require('../backend/src/models');

// 장르 정리: 원본 사이트의 미분류 값 "?"와 장르 없음(null, 빈 문자열)을 모두 '기타'로 통일
// (이전에는 null을 '?'로 저장해서 원본의 "?" 35개 + null 8개 = 43개가 '?' 장르로 들어갔음)
const UNKNOWN_GENRE = '기타';
function normalizeGenre(genre) {
  const value = typeof genre === 'string' ? genre.trim() : '';
  if (!value || value === '?') return UNKNOWN_GENRE;
  return value;
}

async function importThemes() {
  try {
    // 1. JSON 파일 읽기
    const filePath = path.join(__dirname, 'data/themes180.json');
    const json = await fs.readFile(filePath, 'utf8');
    const themes = JSON.parse(json);

    // 2. DB 연결 확인
    await sequelize.authenticate();
    console.log('DB 연결 성공');

    let insertCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // 3. 테마별 INSERT 또는 UPDATE
    for (const theme of themes) {
      try {
        const existingTheme = await Theme.findByPk(theme.id);

        // 이미 존재하는 테마
        if (existingTheme) {

          // DB에 이미지가 없고 JSON에는 이미지가 있다면 UPDATE
          if (!existingTheme.thumbnailUrl && theme.thumbnailUrl) {
            await existingTheme.update({
              thumbnailUrl: theme.thumbnailUrl
            });

            console.log(`이미지 업데이트: ${theme.id} - ${theme.title}`);
            updateCount++;
          } else {
            console.log(`건너뜀: ${theme.id} - ${theme.title}`);
            skipCount++;
          }

          continue;
        }

        // 신규 테마 INSERT
        await Theme.create({
          id: theme.id,
          userId: 'star',
          title: theme.title ?? '이름 없음',
          storeName: theme.storeName ?? '매장 정보 없음',
          address: theme.address ?? '주소 정보 없음',
          content: theme.content ?? '',
          minPeople: theme.minPeople ?? 0,
          maxPeople: theme.maxPeople ?? 0,
          playTime: theme.playTime ?? 0,
          difficulty: theme.difficulty ?? 0,
          price: theme.price ?? 0,
          genre: normalizeGenre(theme.genre), // "?"·null·빈 값 → '기타'
          thumbnailUrl: theme.thumbnailUrl ?? null,
          latitude: theme.latitude ?? null,
          longitude: theme.longitude ?? null
        });

        console.log(`등록 완료: ${theme.id} - ${theme.title}`);
        insertCount++;

      } catch (error) {
        console.error(`등록 실패: ${theme.id} - ${theme.title}`);
        console.error(error.message);
        failCount++;
      }
    }

    // 4. 최종 결과
    console.log('\n===== 데이터 반영 결과 =====');
    console.log(`신규 등록: ${insertCount}개`);
    console.log(`이미지 업데이트: ${updateCount}개`);
    console.log(`건너뜀: ${skipCount}개`);
    console.log(`실패: ${failCount}개`);
    console.log(`전체 처리: ${themes.length}개`);

  } catch (error) {
    console.error('데이터 반영 실패:', error);
  } finally {
    await sequelize.close();
  }
}

importThemes();
