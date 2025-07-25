# 슬라임 RPG 에셋 폴더

이 폴더는 슬라임 RPG 게임의 직업별 스프라이트 이미지들을 저장하는 곳입니다.

## 직업별 슬라임 스프라이트 (방향별)

현재 게임에서는 5개의 직업이 있으며, 각 직업마다 4방향 스프라이트가 필요합니다:

### 1. 기본 슬라임 (slime)
- **파일명**: `slime_front.png`, `slime_back.png`, `slime_left.png`, `slime_right.png`
- **설명**: 초록색 둥근 슬라임 (방향별로 모양이 다름)
- **특징**: 기본 직업, 균형잡힌 스탯

### 2. 어쌔신 슬라임 (assassin)
- **파일명**: `assassin_front.png`, `assassin_back.png`, `assassin_left.png`, `assassin_right.png`
- **설명**: 검은색 뾰족한 슬라임 (방향별로 뾰족한 부분 위치가 다름)
- **특징**: 단검 도적, 은신 능력, 높은 공격력, 낮은 체력

### 3. 닌자 슬라임 (ninja)
- **파일명**: `ninja_front.png`, `ninja_back.png`, `ninja_left.png`, `ninja_right.png`
- **설명**: 보라색 표창 슬라임 (방향별로 표창 위치가 다름)
- **특징**: 표창 도적, 은신 능력, 높은 공격력, 낮은 체력

### 4. 전사 슬라임 (warrior)
- **파일명**: `warrior_front.png`, `warrior_back.png`, `warrior_left.png`, `warrior_right.png`
- **설명**: 빨간색 각진 슬라임 (방향별로 각진 부분 위치가 다름)
- **특징**: 높은 체력과 방어력, 돌진 능력

### 5. 마법사 슬라임 (mage)
- **파일명**: `mage_front.png`, `mage_back.png`, `mage_left.png`, `mage_right.png`
- **설명**: 파란색 별 모양 슬라임 (방향별로 마법 효과 위치가 다름)
- **특징**: 원거리 마법, 와드 능력

## 이미지 파일 요구사항

- **크기**: 32x32 픽셀 (권장)
- **형식**: PNG (투명 배경 지원)
- **스타일**: 픽셀 아트 또는 카툰 스타일

## 사용법

1. 각 직업에 맞는 이미지 파일을 이 폴더에 저장
2. 파일명은 위의 규칙을 따라야 함
3. `AssetLoader.js`에서 이미지 로딩 코드 추가
4. 게임에서 직업 변경 시 자동으로 스프라이트 변경

## 현재 구현 상태

현재는 실제 이미지 파일과 코드로 생성된 스프라이트를 혼합 사용하고 있습니다:

### 기본 슬라임 ✅ (실제 이미지 사용)
- **파일**: `slime_front.png`, `slime_back.png`, `slime_left.png`, `slime_right.png`
- **상태**: 실제 이미지 파일 적용됨

### 어쌔신 (코드 생성)
- **front**: 검은색 타원 + 위쪽 뾰족한 부분
- **back**: 작은 검은색 타원
- **left**: 검은색 타원 + 왼쪽 뾰족한 부분
- **right**: 검은색 타원 + 오른쪽 뾰족한 부분

### 닌자 (코드 생성)
- **front**: 보라색 타원 + 위쪽 표창 모양
- **back**: 작은 보라색 타원
- **left**: 보라색 타원 + 왼쪽 표창
- **right**: 보라색 타원 + 오른쪽 표창

### 전사 ✅ (실제 이미지 사용)
- **파일**: `warrior_front.png`, `warrior_back.png`, `warrior_left.png`, `warrior_right.png`
- **상태**: 실제 이미지 파일 적용됨

### 마법사 (코드 생성)
- **front**: 파란색 원 + 흰색 원 + 파란색 중심
- **back**: 작은 파란색 원들
- **left**: 파란색 타원 + 왼쪽 마법 효과
- **right**: 파란색 타원 + 오른쪽 마법 효과

## 이미지 파일 추가 방법

다른 직업들도 실제 이미지로 교체하려면:
1. `assets` 폴더에 `{직업}_{방향}.png` 형식으로 이미지 파일 추가
2. `AssetLoader.js`의 `imageJobs` 배열에 해당 직업 추가 