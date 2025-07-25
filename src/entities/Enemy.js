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
                this.setTint(0xff6600);
                break;
            case 'tank':
                this.maxHp = 200;
                this.hp = this.maxHp;
                this.attack = 25;
                this.moveSpeed = 60;
                this.setTint(0x8b4513);
                break;
            case 'ranged':
                this.maxHp = 80;
                this.hp = this.maxHp;
                this.attack = 20;
                this.moveSpeed = 80;
                this.attackRange = 120;
                this.setTint(0x9932cc);
                break;
            default: // basic
                this.maxHp = 100;
                this.hp = this.maxHp;
                this.attack = 20;
                this.moveSpeed = 100;
                this.setTint(0xff0000);
                break;
        }
    }
    
    update(time, delta) {
        if (this.isDead) return;
        
        const player = this.scene.player;
        if (!player) return;
        
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
        // 랜덤한 방향으로 순찰
        if (Phaser.Math.Between(0, 100) < 2) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const velocityX = Math.cos(angle) * this.moveSpeed * 0.5;
            const velocityY = Math.sin(angle) * this.moveSpeed * 0.5;
            
            this.setVelocity(velocityX, velocityY);
            this.lastDirection = { x: velocityX, y: velocityY };
        }
    }
    
    startPatrol() {
        // 초기 순찰 방향 설정
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const velocityX = Math.cos(angle) * this.moveSpeed * 0.5;
        const velocityY = Math.sin(angle) * this.moveSpeed * 0.5;
        
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
        this.hp -= damage;
        
        // 데미지 표시
        this.scene.add.text(this.x, this.y - 20, `-${damage}`, {
            fontSize: '14px',
            fill: '#ff0000'
        }).setOrigin(0.5);
        
        // 피격 애니메이션
        this.setTint(0xffffff);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
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
            onComplete: () => {
                this.destroy();
            }
        });
        
        // 경험치 획득 표시
        this.scene.add.text(this.x, this.y, `+${expAmount} EXP`, {
            fontSize: '16px',
            fill: '#ffff00'
        }).setOrigin(0.5);
    }
    
    getExpReward() {
        switch (this.type) {
            case 'fast': return 15;
            case 'tank': return 30;
            case 'ranged': return 20;
            default: return 10;
        }
    }
} 