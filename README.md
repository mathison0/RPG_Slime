# RPG Slime

Phaser 3를 사용한 2D 탑뷰 RPG 게임입니다. 슬라임 캐릭터로 시작하여 다양한 직업으로 전직하며 미로 같은 맵에서 적들과 전투를 벌이는 게임입니다.

## 게임 특징

### 🎮 게임플레이
- **2D 탑뷰**: 2D 탑뷰 슬라임 RPG 게임
- **미로 맵**: 시야를 차단하는 미로 같은 맵 구조
- **성장 시스템**: 레벨업과 전직을 통한 캐릭터 성장
- **직업 시스템**: 4가지 고유한 직업과 스킬

### 🎯 직업 시스템
1. **슬라임** (기본)
   - 균형잡힌 스탯
   - 점프 스킬

2. **도적**
   - 은신 능력 (추가 데미지)
   - 투사체 통과
   - 넓은 시야
   - 높은 이동속도

3. **전사**
   - 높은 체력과 방어력
   - 돌진 공격
   - 근접 전투 특화

4. **마법사**
   - 와드 생성
   - 원거리 공격
   - 상태이상 효과

### 🎨 게임 요소
- **시야 제한**: 미로 효과로 시야가 제한됨
- **다양한 적**: 기본, 빠른, 탱크, 원거리 적들
- **경험치 시스템**: 적 처치로 레벨업
- **스킬 시스템**: 직업별 고유 스킬

## 조작법

- **WASD / 방향키**: 이동
- **SPACE**: 스킬 사용
- **Q**: 전직

## 설치 및 실행

### 필수 요구사항
- Node.js (v14 이상)
- npm 또는 yarn

### 설치
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 빌드된 파일 서빙
npm run serve
```

## 프로젝트 구조

```
rpg_slime/
├── src/
│   ├── entities/          # 게임 엔티티
│   │   ├── Player.js      # 플레이어 클래스
│   │   └── Enemy.js       # 적 클래스
│   ├── scenes/            # 게임 씬
│   │   ├── MenuScene.js   # 메인 메뉴
│   │   └── GameScene.js   # 메인 게임
│   ├── data/              # 게임 데이터
│   │   └── JobClasses.js  # 직업 정보
│   ├── utils/             # 유틸리티
│   │   └── AssetLoader.js # 에셋 로더
│   └── main.js            # 게임 진입점
├── index.html             # 메인 HTML
├── package.json           # 프로젝트 설정
├── vite.config.js         # Vite 설정
└── README.md              # 프로젝트 설명
```

## 기술 스택

- **Phaser 3**: 게임 엔진
- **Vite**: 빌드 도구
- **JavaScript (ES6+)**: 프로그래밍 언어

## 개발 계획

### 현재 구현된 기능
- ✅ 기본 게임 구조
- ✅ 플레이어 이동 및 스킬
- ✅ 직업 시스템
- ✅ 적 AI 및 전투
- ✅ 미로 맵 생성
- ✅ 시야 제한 (Fog of War)
- ✅ 레벨업 시스템

### 향후 추가 예정
- 🔄 더 복잡한 미로 생성 알고리즘
- 🔄 히든 직업 시스템
- 🔄 아이템 및 장비 시스템
- 🔄 멀티플레이어 지원
- 🔄 사운드 및 음악
- 🔄 더 다양한 적과 보스
- 🔄 스킬 트리 시스템

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request 