# 스킬 동기화 시스템 가이드

## 개요

이 문서는 RPG Slime 게임의 스킬 동기화 시스템에 대한 완전한 가이드입니다. 서버-클라이언트 간 데미지 계산, 시각적 효과, 쿨타임 관리를 포함한 모든 동기화 메커니즘을 설명합니다.

## 목차

1. [시스템 아키텍처](#시스템-아키텍처)
2. [데미지 동기화](#데미지-동기화)
3. [시각적 효과 동기화](#시각적-효과-동기화)
4. [쿨타임 관리](#쿨타임-관리)
5. [새로운 스킬 추가 가이드](#새로운-스킬-추가-가이드)
6. [문제 해결](#문제-해결)

## 시스템 아키텍처

### 전체 흐름

```
클라이언트 스킬 사용 → 서버 검증 → 데미지 계산 → 모든 클라이언트에 브로드캐스트 → 시각적 효과 표시
```

### 주요 컴포넌트

- **클라이언트**: `NetworkEventManager.js`, `BaseJob.js`, 직업별 스킬 클래스
- **서버**: `SkillManager.js`, `SocketEventManager.js`
- **공유**: `JobClasses.js` (스킬 정보 정의)

## 데미지 동기화

### 서버 측 데미지 계산

```javascript
// SkillManager.js
applySkillDamage(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
        affectedEnemies: [],
        affectedPlayers: [],
        totalDamage: 0
    };
    
    // 직업별 스킬 처리
    switch (player.jobClass) {
        case 'warrior':
            return this.applyWarriorSkill(player, skillType, skillInfo, x, y, targetX, targetY);
        case 'slime':
            return this.applySlimeSkill(player, skillType, skillInfo, x, y);
        // ... 기타 직업들
    }
}
```

### 클라이언트 측 데미지 표시

```javascript
// NetworkEventManager.js
handleSkillDamageResult(damageResult) {
    // 적들에게 데미지 적용된 경우
    if (damageResult.affectedEnemies && damageResult.affectedEnemies.length > 0) {
        damageResult.affectedEnemies.forEach(enemyData => {
            const enemy = this.scene.enemies?.getChildren().find(e => e.networkId === enemyData.id);
            if (enemy) {
                // 실제 적용된 데미지 텍스트 표시
                const damageToShow = enemyData.actualDamage || enemyData.damage;
                this.scene.effectManager.showDamageText(enemy.x, enemy.y, damageToShow);
            }
        });
    }
}
```

## 시각적 효과 동기화

### 스프라이트 강제 유지 시스템

#### 1. 상태 플래그 설정

```javascript
// NetworkEventManager.js - 스킬 시작 시
player.isUsingSlimeSkill = true;  // 슬라임 스킬용
player.isUsingRoarSkill = true;   // 울부짖기용
```

#### 2. 스프라이트 변경 차단

```javascript
// Player.js - updateJobSprite()
updateJobSprite() {
    // 스킬 사용 중일 때는 스프라이트 변경하지 않음
    if (this.isUsingSlimeSkill || this.isUsingRoarSkill) {
        return;
    }
    
    // 정상적인 스프라이트 업데이트 로직
    const spriteKey = AssetLoader.getPlayerSpriteKey(this.jobClass, this.direction);
    // ...
}
```

#### 3. 타이머 기반 복원

```javascript
// NetworkEventManager.js - 스킬 종료 시
player.slimeSkillTimer = this.scene.time.delayedCall(effectDuration, () => {
    // 스킬 상태 해제
    player.isUsingSlimeSkill = false;
    
    // 스프라이트 복원
    if (player.active) {
        player.updateJobSprite();
    }
    
    // 타이머 참조 정리
    player.slimeSkillTimer = null;
});
```

### 중복 실행 방지

```javascript
// 기존 이펙트가 있다면 제거
if (player.slimeSkillEffect) {
    player.slimeSkillEffect.destroy();
    player.slimeSkillEffect = null;
}

// 기존 타이머가 있다면 제거
if (player.slimeSkillTimer) {
    this.scene.time.removeEvent(player.slimeSkillTimer);
    player.slimeSkillTimer = null;
}
```

### 정리 작업

```javascript
// Player.js - destroy()
destroy() {
    // 스킬 이펙트 타이머 정리
    if (this.roarEffectTimer) {
        this.scene.time.removeEvent(this.roarEffectTimer);
        this.roarEffectTimer = null;
    }
    
    if (this.slimeSkillTimer) {
        this.scene.time.removeEvent(this.slimeSkillTimer);
        this.slimeSkillTimer = null;
    }
    
    // 스킬 이펙트 정리
    if (this.slimeSkillEffect) {
        this.slimeSkillEffect.destroy();
        this.slimeSkillEffect = null;
    }
    
    // ... 기타 정리 작업
}
```

## 쿨타임 관리

### 클라이언트 측 쿨타임 설정

```javascript
// BaseJob.js
setSkillCooldown(skillKey, duration) {
    const cooldownEnd = this.scene.time.now + duration;
    this.skillCooldowns.set(skillKey, cooldownEnd);
}

isSkillAvailable(skillKey) {
    const now = this.scene.time.now;
    const cooldownEnd = this.skillCooldowns.get(skillKey) || 0;
    return now >= cooldownEnd;
}
```

### 서버 응답 기반 쿨타임 설정

```javascript
// NetworkEventManager.js
handlePlayerSkillUsed(data) {
    // 본인 플레이어의 스킬 사용 성공 시 쿨타임 설정
    if (isOwnPlayer && player.job && data.skillType !== 'roar') {
        this.setSkillCooldown(player, data.skillType);
    }
}

setSkillCooldown(player, skillType) {
    if (!player.job) return;
    
    // 직업별 스킬 정보 가져오기
    const jobInfo = player.job.jobInfo;
    if (!jobInfo || !jobInfo.skills) return;
    
    // 스킬 정보 찾기
    const skillInfo = jobInfo.skills.find(skill => skill.type === skillType);
    if (!skillInfo) return;
    
    // 쿨타임 설정
    player.job.setSkillCooldown(skillType, skillInfo.cooldown);
}
```

## 새로운 스킬 추가 가이드

### 1. 스킬 정보 정의 (JobClasses.js)

```javascript
skills: [
    {
        name: '새로운 스킬',
        description: '스킬 설명',
        cooldown: 3000,        // 쿨타임 (ms)
        damage: 'attack * 1.5', // 데미지 공식
        range: 100,            // 범위
        duration: 2000,        // 지속시간 (ms) - 시각적 효과용
        key: '1',              // 단축키
        type: 'new_skill'      // 스킬 타입 (중요!)
    }
]
```

### 2. 서버 측 데미지 처리 (SkillManager.js)

```javascript
// applyNewJobSkill 메서드 추가
applyNewJobSkill(player, skillType, skillInfo, x, y, targetX, targetY) {
    const damageResult = {
        affectedEnemies: [],
        affectedPlayers: [],
        totalDamage: 0
    };

    switch (skillType) {
        case 'new_skill':
            this.applyNewSkillDamage(player, x, y, skillInfo.range, skillInfo.damage, damageResult);
            break;
    }

    return damageResult;
}

// 데미지 적용 메서드 추가
applyNewSkillDamage(player, x, y, range, damage, damageResult) {
    const enemies = this.gameStateManager.enemies;
    const players = this.gameStateManager.players;

    // 적들 대상
    enemies.forEach(enemy => {
        if (enemy.isDead) return;
        const distance = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
        if (distance <= range) {
            const actualDamage = Math.max(1, damage - enemy.defense);
            enemy.takeDamage(damage);
            damageResult.affectedEnemies.push({
                id: enemy.id,
                damage: damage,
                actualDamage: actualDamage,
                x: enemy.x,
                y: enemy.y
            });
            damageResult.totalDamage += actualDamage;
        }
    });

    // 다른 팀 플레이어들 대상 (필요시)
    // ...
}
```

### 3. 클라이언트 측 시각적 효과 (NetworkEventManager.js)

```javascript
// showSkillEffect 메서드에 추가
showSkillEffect(player, skillType, data = null) {
    switch (skillType) {
        // ... 기존 케이스들
        case 'new_skill':
            this.showNewSkillEffect(player, data);
            break;
    }
}

// 새로운 스킬 이펙트 메서드 추가
showNewSkillEffect(player, data = null) {
    // 기존 이펙트 정리
    if (player.newSkillEffect) {
        player.newSkillEffect.destroy();
        player.newSkillEffect = null;
    }
    
    if (player.newSkillTimer) {
        this.scene.time.removeEvent(player.newSkillTimer);
        player.newSkillTimer = null;
    }
    
    // 스킬 상태 설정
    player.isUsingNewSkill = true;
    
    // 스프라이트 변경 (필요시)
    player.setTexture('new_skill_sprite');
    
    // 범위 효과 생성
    const effect = this.scene.add.circle(player.x, player.y, range, 0xff0000, 0.3);
    player.newSkillEffect = effect;
    
    // 지속시간 설정
    const effectDuration = data?.skillInfo?.duration || 2000;
    
    // 타이머 설정
    player.newSkillTimer = this.scene.time.delayedCall(effectDuration, () => {
        // 이펙트 제거
        if (effect.active) {
            effect.destroy();
        }
        
        // 상태 해제
        player.isUsingNewSkill = false;
        
        // 스프라이트 복원
        if (player.active) {
            player.updateJobSprite();
        }
        
        // 참조 정리
        player.newSkillEffect = null;
        player.newSkillTimer = null;
    });
}
```

### 4. Player.js 업데이트

```javascript
// updateJobSprite 메서드에 새로운 스킬 상태 추가
updateJobSprite() {
    // 스킬 사용 중일 때는 스프라이트 변경하지 않음
    if (this.isUsingSlimeSkill || this.isUsingRoarSkill || this.isUsingNewSkill) {
        return;
    }
    // ... 나머지 로직
}

// destroy 메서드에 새로운 타이머 정리 추가
destroy() {
    // ... 기존 정리 작업
    
    if (this.newSkillTimer) {
        this.scene.time.removeEvent(this.newSkillTimer);
        this.newSkillTimer = null;
    }
    
    if (this.newSkillEffect) {
        this.newSkillEffect.destroy();
        this.newSkillEffect = null;
    }
}
```

## 문제 해결

### 일반적인 문제들

#### 1. 스프라이트가 즉시 복원되는 문제
**원인**: `updateJobSprite()`가 다른 곳에서 호출됨
**해결**: 스킬 상태 플래그를 사용하여 차단

#### 2. 쿨타임이 적용되지 않는 문제
**원인**: 서버 응답을 기다리지 않고 쿨타임 설정
**해결**: 스킬 사용 시 즉시 쿨타임 설정하거나 서버 응답 후 설정

#### 3. 중복 이펙트 실행 문제
**원인**: 기존 타이머가 제거되지 않음
**해결**: 새 이펙트 시작 전 기존 타이머와 이펙트 정리

#### 4. 메모리 누수 문제
**원인**: 타이머와 이펙트가 정리되지 않음
**해결**: `destroy()` 메서드에서 모든 타이머와 이펙트 정리

### 디버깅 팁

1. **콘솔 로그 확인**: 각 단계별 로그 메시지 확인
2. **타이머 상태 확인**: `player.skillTimer` 참조 확인
3. **상태 플래그 확인**: `player.isUsingSkill` 상태 확인
4. **네트워크 지연 확인**: 타임스탬프 기반 지연시간 계산

## 성능 최적화

### 1. 타이머 관리
- 불필요한 타이머 제거
- 타이머 참조 정리
- 중복 타이머 방지

### 2. 이펙트 관리
- 이펙트 객체 재사용
- 적절한 시점에 이펙트 제거
- 메모리 누수 방지

### 3. 네트워크 최적화
- 타임스탬프 기반 동기화
- 지연시간이 큰 경우 이펙트 스킵
- 불필요한 데이터 전송 최소화

---

이 가이드를 따라하면 모든 스킬에 대해 일관된 동기화 시스템을 구축할 수 있습니다. 