import Phaser from 'phaser';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type = 'basic') {
        super(scene, x, y, 'enemy');
        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        this.type = type;
        this.setupEnemyType();
        
        // 기본 설정
        this.setDisplaySize(24, 24);
        this.setCollideWorldBounds(true);
        this.body.setSize(20, 20);
        
        // AI 관련
        this.moveSpeed = 100;
        this.detectionRange = 150;
        this.attackRange = 30;
        this.lastAttackTime = 0;
        this.attackCooldown = 1000;
        
        // 상태
        this.isDead = false;
        this.lastDirection = { x: 0, y: 0 };
        
        // 애니메이션
        this.startPatrol();
    }
    
    setupEnemyType() {
        switch (this.type) {
            case 'fast':
                this.maxHp = 50;
                this.hp = this.maxHp;
                this.attack = 15;
                this.moveSpeed = 150;
                this.setTint(0xff6600); // 주황색
                break;
            case 'tank':
                this.maxHp = 200;
                this.hp = this.maxHp;
                this.attack = 25;
                this.moveSpeed = 60;
                this.setTint(0x8b4513); // 갈색
                break;
            case 'ranged':
                this.maxHp = 80;
                this.hp = this.maxHp;
                this.attack = 20;
                this.moveSpeed = 80;
                this.attackRange = 120;
                this.setTint(0x9932cc); // 보라색
                break;
            default: // basic
                this.maxHp = 100;
                this.hp = this.maxHp;
                this.attack = 20;
                this.moveSpeed = 100;
                this.setTint(0xff0000); // 빨간색
                break;
        }
    }
    
    // Enemy.js의 update 메서드
    update(time, delta) {
        if (this.isDead) return;
        
        // 서버에서 관리되는 적은 클라이언트에서 AI 실행하지 않음
        if (this.isServerControlled) {
            return;
        }
        
        const player = this.scene.player;
        if (!player || !player.active) {
            this.setVelocity(0, 0);
            return;
        }

        // [핵심 로직]
        // 1. 매 프레임마다 플레이어가 스폰 구역에 있는지 최우선으로 확인합니다.
        const inRedSpawn = this.scene.redSpawnRect.contains(player.x, player.y);
        const inBlueSpawn = this.scene.blueSpawnRect.contains(player.x, player.y);

        // 2. 만약 플레이어가 스폰 구역 안에 있다면,
        if (inRedSpawn || inBlueSpawn) {
            // 어그로 상태였더라도 즉시 순찰(patrol) 상태로 전환하고,
            this.patrol(); 
            // update 함수를 여기서 종료하여 아래의 추적(chasePlayer) 코드가 실행되지 않게 합니다.
            return; 
        }
        // [핵심 로직 끝]

        // 3. (플레이어가 스폰 구역 밖에 있을 때만 이 코드가 실행됩니다)
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        
        if (distance <= this.detectionRange) {
            this.chasePlayer(player, distance);
        } else {
            this.patrol();
        }
    }
    
    chasePlayer(player, distance) {
        // 플레이어 방향으로 이동
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const velocityX = Math.cos(angle) * this.moveSpeed;
        const velocityY = Math.sin(angle) * this.moveSpeed;
        
        this.setVelocity(velocityX, velocityY);
        this.lastDirection = { x: velocityX, y: velocityY };
        
        // 공격 범위 내에 있으면 공격
        if (distance <= this.attackRange) {
            this.attackPlayer(player);
        }
    }
    
    patrol() {
        // 현재 속도가 거의 0일 때만 새로운 순찰 방향을 설정 (벽에 부딪혔을 때 등)
        if (this.body.velocity.length() < 10) {
            this.startPatrol();
        }
        
        // 주기적으로 순찰 방향 변경
        if (Phaser.Math.Between(0, 200) < 1) {
            this.startPatrol();
        }
    }
    
    startPatrol() {
        // 초기 순찰 방향 설정
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        // 순찰 시에는 속도를 약간 줄임
        const patrolSpeed = this.moveSpeed * 0.5;
        const velocityX = Math.cos(angle) * patrolSpeed;
        const velocityY = Math.sin(angle) * patrolSpeed;
        
        this.setVelocity(velocityX, velocityY);
        this.lastDirection = { x: velocityX, y: velocityY };
    }
    
    attackPlayer(player) {
        const currentTime = this.scene.time.now;
        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.lastAttackTime = currentTime;
            
            // 근접 공격
            if (this.type !== 'ranged') {
                player.takeDamage(this.attack);
                
                // 공격 애니메이션
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.2,
                    scaleY: 1.2,
                    duration: 100,
                    yoyo: true
                });
            } else {
                // 원거리 공격
                this.rangedAttack(player);
            }
        }
    }
    
    rangedAttack(player) {
        // 투사체 생성
        const projectile = this.scene.add.circle(this.x, this.y, 5, 0xff0000);
        this.scene.physics.add.existing(projectile);
        
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const velocityX = Math.cos(angle) * 200;
        const velocityY = Math.sin(angle) * 200;
        
        projectile.body.setVelocity(velocityX, velocityY);
        
        // 투사체 충돌 체크
        this.scene.physics.add.overlap(projectile, player, () => {
            player.takeDamage(this.attack);
            projectile.destroy();
        });
        
        // 3초 후 투사체 제거
        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }
    
    takeDamage(damage) {
        if (this.isDead) return;

        this.hp -= damage;
        
        // 데미지 표시
        const damageText = this.scene.add.text(this.x, this.y - 20, `-${damage}`, {
            fontSize: '14px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 텍스트가 위로 올라가며 사라지는 효과
        this.scene.tweens.add({
            targets: damageText,
            y: damageText.y - 30,
            alpha: 0,
            duration: 800,
            ease: 'Power1',
            onComplete: () => {
                damageText.destroy();
            }
        });
        
        // 피격 시 색상 변경 후 원래 색으로 복귀
        this.setTintFill(0xffffff); // 흰색으로 번쩍임
        this.scene.time.delayedCall(100, () => {
            if (this.active) {
                this.clearTint();
                this.setupEnemyType(); // 원래 색상으로 복구
            }
        });
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        this.body.enable = false; // 물리 효과 비활성화
        this.setVelocity(0, 0);
        
        // 경험치 드롭
        const expAmount = this.getExpReward();
        this.scene.player.gainExp(expAmount);
        
        // 사망 애니메이션
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.destroy();
            }
        });
        
        // 경험치 획득 표시
        const expText = this.scene.add.text(this.x, this.y, `+${expAmount} EXP`, {
            fontSize: '16px',
            fill: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: expText,
            y: expText.y - 40,
            alpha: 0,
            duration: 1200,
            ease: 'Power1',
            onComplete: () => {
                expText.destroy();
            }
        });
    }
    
    getExpReward() {
        switch (this.type) {
            case 'fast': return 15;
            case 'tank': return 30;
            case 'ranged': return 20;
            default: return 10;
        }
    }

    // 네트워크 ID 설정
    setNetworkId(id) {
        this.networkId = id;
    }
}