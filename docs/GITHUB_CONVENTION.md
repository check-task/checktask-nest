# GitHub Convention

## 1. 브랜치 전략

```
main        ← 배포 브랜치
 └ develop  ← 개발 통합 브랜치
    └ feat/{작업명}, fix/{작업명}, refactor/{작업명} ...  ← 작업 브랜치
```

| 브랜치 | 용도 | 생성 위치 |
|---|---|---|
| `main` | 배포되는 코드. 직접 push 금지 | - |
| `develop` | 다음 배포를 위한 통합 브랜치. 직접 push 금지 | `main` |
| `{type}/{작업명}` | 기능·수정 작업 | `develop` |

- 작업 브랜치명은 `{type}/{작업명}` 형식, 작업명은 kebab-case입니다. (예: `feat/auth-domain`, `fix/task-deadline`)
- 작업 브랜치는 머지 후 삭제합니다.

## 2. 머지 전략

| 방향 | 방식 | 이유 |
|---|---|---|
| 작업 브랜치 → `develop` | **Squash and merge** | 작업 중 커밋을 하나로 합쳐 develop 히스토리를 기능 단위로 유지 |
| `develop` → `main` | **Create a merge commit** | 배포 시점을 머지 커밋으로 남기고, develop의 커밋을 그대로 보존 |

- Squash 머지 시 커밋 메시지는 아래 커밋 컨벤션 형식으로 정리합니다. (예: `feat : 로그인 기능 추가 (#1)`)
- `develop` → `main` PR 제목은 `[Release] {버전 또는 날짜}` 형식으로 작성합니다.
- `main`에서 `develop`으로의 역방향 머지는 하지 않습니다. 작업 브랜치는 항상 `develop`에서 분기합니다.

## 3. 커밋 컨벤션

```
{type} : {요약}
```

| type | 설명 |
|---|---|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 코드 구조 개선 |
| `docs` | 문서 수정 |
| `test` | 테스트 추가·수정 |
| `chore` | 빌드·설정·패키지 등 기타 작업 |

- 요약은 한국어, 명사형으로 끝냅니다. (예: `feat : 과제 생성 API 추가`)
- 한 커밋에는 하나의 변경 목적만 담습니다.
- 커밋 전 `npm run format`, `npm run lint`를 실행합니다. (코드 규칙은 [`CODE_CONVENTION.md`](CODE_CONVENTION.md))
- 에러 코드를 추가했다면 같은 커밋에서 `CODE_CONVENTION.md`의 에러 코드 표도 함께 수정합니다.

## 4. 이슈

- 작업 전 이슈를 먼저 만들고, 템플릿(`🚀 Feature` / `🐛 Bug` / `🔨 Refactor`)을 사용합니다.
- 이슈 제목: `[Feat] {요약}`, `[Fix] {요약}`, `[Refactor] {요약}`

## 5. Pull Request

- PR 템플릿(`.github/PULL_REQUEST_TEMPLATE.md`)을 사용합니다.
- 제목: `[{Type}/#{이슈 번호}] {요약}` (예: `[Feat/#1] 로그인 기능 추가`)
- 본문에 `Closes #{이슈 번호}`를 넣어 머지 시 이슈가 자동으로 닫히게 합니다.
- 리뷰어 승인 1명 이상 후 머지합니다.

## 6. 저장소 설정

- Settings → General → Pull Requests
  - `Allow squash merging`, `Allow merge commits` 활성화 / `Allow rebase merging` 비활성화
  - `Automatically delete head branches` 활성화
- Settings → Branches → `main`, `develop` 보호 규칙
  - `Require a pull request before merging` (직접 push 금지)
