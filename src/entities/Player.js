import Phaser from 'phaser';
import { JobClasses } from '../data/JobClasses.js';
import AssetLoader from '../utils/AssetLoader.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, team = 'red') {
        super(scene, x, y, 'player');

        
        this.scene = scene;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        // 네트워크 관련
        this.networkId = null;
        this.networkManager = null;
        this.isOtherPlayer = false; // 다른 플레이어인지 여부
        this.nameText = null; // 이름 텍스트
        
        // 기본 스탯
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.speed = 200;
        this.attack = 20;
        this.defense = 10;
        
        // 직업 관련
        this.jobClass = 'slime'; // 기본 슬라임
        this.jobLevel = 1;
        this.skills = [];
        
        // 크기 관련 (기본 크기 설정)
        this.size = 64; // 기본 표시 크기 (updateCharacterSize에서 레벨에 따라 재계산됨)
        this.baseCameraZoom = 1; // 기본 카메라 줌 레벨
        this.colliderSize = 0; // updateCharacterSize에서 계산됨

        // 방향 관련
        this.direction = 'front'; // 기본 방향
        this.lastDirection = 'front';
        
        // 초기 스프라이트 설정 (updateCharacterSize도 포함)
        this.updateJobSprite();
        
        // 상태
        this.isJumping = false; // 점프 중인지 확인하는 상태

        // 팀 및 상태
        this.team = team; // 'red' | 'blue'

        this.isStealth = false;
        this.stealthCooldown = 0;
        this.stealthDuration = 0;
        this.stealthBonusDamage = 0;
        
        // 테스트용 무적 모드
        this.isInvincible = false;
        
        // 시야 범위
        this.visionRange = 300;
        this.minimapVisionRange = 200;
        
        // 물리 속성
        this.setCollideWorldBounds(true);
        
        // 입력 (본인 플레이어만)
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.qKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.eKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.rKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.iKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
        this.lKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
        this.fKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        
        // 스킬 키 (숫자키)
        this.oneKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.twoKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.threeKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
        
        // 스킬 쿨타임 UI 초기화
        this.skillCooldownUI = null;
        this.slimeSkillCooldown = 0;
        
        // 슬라임 퍼지기 스킬 쿨타임 (3초)
        this.SLIME_SPREAD_COOLDOWN = 3000;
        
        // 마법사 스킬 쿨타임
        this.mageWardCooldown = 0;
        this.mageIceFieldCooldown = 0;
        this.mageMagicMissileCooldown = 0;
        
        // 마법사 스킬 쿨타임 설정
        this.MAGE_WARD_COOLDOWN = 8000;        // 와드 8초
        this.MAGE_ICE_FIELD_COOLDOWN = 12000;  // 얼음 장판 12초
        this.MAGE_MAGIC_MISSILE_COOLDOWN = 3000; // 마법 투사체 3초
        
        // 쿨타임 메시지 상태 관리
        this.cooldownMessageActive = false;
        
        // UI 업데이트
        this.updateUI();
        
        console.log('Player 생성 완료:', this.x, this.y, this.team, this.jobClass);
    }
    
    calculateColliderSize() {
        return this.size + 450;
    }
    
    // 크기 업데이트 메서드
    updateSize() {
        // 표시 크기 설정
        this.setDisplaySize(this.size, this.size);
        
        // 충돌체 크기 동기화
        this.colliderSize = this.calculateColliderSize();
        if (this.body) {
            this.body.setSize(this.colliderSize, this.colliderSize);
        }
    }
    
    // 크기 변경 메서드
    setSize(newSize) {
        this.size = newSize;
        this.updateSize();
    }
    
    // 크기 가져오기
    getSize() {
        return this.size;
    }
    
    // 스킬 쿨타임 UI 생성
    createSkillCooldownUI() {
        if (this.skillCooldownUI) {
            // 기존 UI 제거
            if (this.skillCooldownUI.background) this.skillCooldownUI.background.destroy();
            if (this.skillCooldownUI.cooldown) this.skillCooldownUI.cooldown.destroy();
            if (this.skillCooldownUI.number) this.skillCooldownUI.number.destroy();
            if (this.skillCooldownUI.background2) this.skillCooldownUI.background2.destroy();
            if (this.skillCooldownUI.cooldown2) this.skillCooldownUI.cooldown2.destroy();
            if (this.skillCooldownUI.number2) this.skillCooldownUI.number2.destroy();
            if (this.skillCooldownUI.background3) this.skillCooldownUI.background3.destroy();
            if (this.skillCooldownUI.cooldown3) this.skillCooldownUI.cooldown3.destroy();
            if (this.skillCooldownUI.number3) this.skillCooldownUI.number3.destroy();
        }
        
        const radius = 25;
        const spacing = 70; // UI 간격
        
        // 첫 번째 스킬 UI (1번키)
        const uiX1 = 80;
        const uiY1 = this.scene.scale.height - 120;
        
        const background1 = this.scene.add.graphics();
        background1.fillStyle(0x333333, 0.8);
        background1.fillCircle(uiX1, uiY1, radius);
        background1.setScrollFactor(0);
        background1.setDepth(1000);
        
        const cooldown1 = this.scene.add.graphics();
        cooldown1.setScrollFactor(0);
        cooldown1.setDepth(1001);
        
        const number1 = this.scene.add.text(uiX1, uiY1, '1', {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        number1.setScrollFactor(0);
        number1.setDepth(1002);
        
        // 두 번째 스킬 UI (2번키) - 마법사만
        let background2, cooldown2, number2;
        if (this.jobClass === 'mage') {
            const uiX2 = uiX1 + spacing;
            const uiY2 = uiY1;
            
            background2 = this.scene.add.graphics();
            background2.fillStyle(0x333333, 0.8);
            background2.fillCircle(uiX2, uiY2, radius);
            background2.setScrollFactor(0);
            background2.setDepth(1000);
            
            cooldown2 = this.scene.add.graphics();
            cooldown2.setScrollFactor(0);
            cooldown2.setDepth(1001);
            
            number2 = this.scene.add.text(uiX2, uiY2, '2', {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            number2.setScrollFactor(0);
            number2.setDepth(1002);
        }
        
        // 세 번째 스킬 UI (3번키) - 마법사만
        let background3, cooldown3, number3;
        if (this.jobClass === 'mage') {
            const uiX3 = uiX1 + spacing * 2;
            const uiY3 = uiY1;
            
            background3 = this.scene.add.graphics();
            background3.fillStyle(0x333333, 0.8);
            background3.fillCircle(uiX3, uiY3, radius);
            background3.setScrollFactor(0);
            background3.setDepth(1000);
            
            cooldown3 = this.scene.add.graphics();
            cooldown3.setScrollFactor(0);
            cooldown3.setDepth(1001);
            
            number3 = this.scene.add.text(uiX3, uiY3, '3', {
                fontSize: '18px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            number3.setScrollFactor(0);
            number3.setDepth(1002);
        }
        
        this.skillCooldownUI = {
            background: background1,
            cooldown: cooldown1,
            number: number1,
            x: uiX1,
            y: uiY1,
            radius: radius,
            background2: background2,
            cooldown2: cooldown2,
            number2: number2,
            x2: uiX1 + spacing,
            y2: uiY1,
            background3: background3,
            cooldown3: cooldown3,
            number3: number3,
            x3: uiX1 + spacing * 2,
            y3: uiY1
        };
    }
    
    // 스킬 쿨타임 UI 업데이트
    updateSkillCooldownUI() {
        if (!this.skillCooldownUI) {
            this.createSkillCooldownUI();
        }
        
        const now = this.scene.time.now;
        
        // 첫 번째 스킬 쿨타임 업데이트 (1번키)
        this.updateSingleSkillCooldown(
            this.skillCooldownUI.cooldown,
            this.skillCooldownUI.number,
            this.skillCooldownUI.x,
            this.skillCooldownUI.y,
            this.skillCooldownUI.radius,
            this.getCurrentSkillCooldown(1),
            this.getCurrentSkillCooldownTime(1)
        );
        
        // 마법사인 경우 2번, 3번 스킬 쿨타임도 업데이트
        if (this.jobClass === 'mage' && this.skillCooldownUI.cooldown2) {
            this.updateSingleSkillCooldown(
                this.skillCooldownUI.cooldown2,
                this.skillCooldownUI.number2,
                this.skillCooldownUI.x2,
                this.skillCooldownUI.y2,
                this.skillCooldownUI.radius,
                this.getCurrentSkillCooldown(2),
                this.getCurrentSkillCooldownTime(2)
            );
            
            this.updateSingleSkillCooldown(
                this.skillCooldownUI.cooldown3,
                this.skillCooldownUI.number3,
                this.skillCooldownUI.x3,
                this.skillCooldownUI.y3,
                this.skillCooldownUI.radius,
                this.getCurrentSkillCooldown(3),
                this.getCurrentSkillCooldownTime(3)
            );
        }
    }
    
    // 현재 스킬의 쿨타임 시간 가져오기
    getCurrentSkillCooldown(skillNumber) {
        switch (this.jobClass) {
            case 'mage':
                switch (skillNumber) {
                    case 1: return this.mageWardCooldown;
                    case 2: return this.mageIceFieldCooldown;
                    case 3: return this.mageMagicMissileCooldown;
                    default: return this.slimeSkillCooldown;
                }
            default:
                return this.slimeSkillCooldown;
        }
    }
    
    // 현재 스킬의 쿨타임 설정값 가져오기
    getCurrentSkillCooldownTime(skillNumber) {
        switch (this.jobClass) {
            case 'mage':
                switch (skillNumber) {
                    case 1: return this.MAGE_WARD_COOLDOWN;
                    case 2: return this.MAGE_ICE_FIELD_COOLDOWN;
                    case 3: return this.MAGE_MAGIC_MISSILE_COOLDOWN;
                    default: return this.SLIME_SPREAD_COOLDOWN;
                }
            default:
                return this.SLIME_SPREAD_COOLDOWN;
        }
    }
    
    // 쿨타임 메시지 표시 (공통 함수)
    showCooldownMessage() {
        // 이미 쿨타임 메시지가 표시 중이면 새로 생성하지 않음
        if (this.cooldownMessageActive) {
            return;
        }
        
        this.cooldownMessageActive = true;
        
        const cooldownText = this.scene.add.text(this.x, this.y - 60, '쿨타임 대기 중!', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        // 메시지를 씬에 직접 추가하고 플레이어 위치 추적
        this.scene.add.existing(cooldownText);
        
        // 메시지 위치를 플레이어와 함께 업데이트하는 함수
        const updateMessagePosition = () => {
            if (cooldownText.active) {
                cooldownText.setPosition(this.x, this.y - 60);
            }
        };
        
        // 0.5초 후 메시지 제거
        this.scene.time.delayedCall(500, () => {
            if (cooldownText.active) {
                cooldownText.destroy();
            }
            this.cooldownMessageActive = false;
        });
        
        // 메시지 위치 업데이트를 위한 타이머 설정
        const positionTimer = this.scene.time.addEvent({
            delay: 16, // 약 60fps
            callback: updateMessagePosition,
            loop: true
        });
        
        // 0.5초 후 타이머 제거
        this.scene.time.delayedCall(500, () => {
            if (positionTimer) {
                positionTimer.destroy();
            }
        });
    }
    
    // 단일 스킬 쿨타임 UI 업데이트
    updateSingleSkillCooldown(cooldownGraphics, numberText, x, y, radius, currentCooldown, maxCooldown) {
        const now = this.scene.time.now;
        const remainingTime = currentCooldown - now;
        
        if (remainingTime > 0) {
            // 쿨타임 진행률 계산 (0~1)
            const progress = 1 - (remainingTime / maxCooldown);
            
            // 쿨타임 원 그리기 (시계방향으로 채워짐)
            cooldownGraphics.clear();
            cooldownGraphics.fillStyle(0x0066ff, 0.8);
            
            // 시계방향으로 채워지는 원 그리기
            const startAngle = -Math.PI / 2; // 12시 방향부터 시작
            const endAngle = startAngle + (progress * 2 * Math.PI);
            
            cooldownGraphics.beginPath();
            cooldownGraphics.moveTo(x, y);
            cooldownGraphics.arc(x, y, radius, startAngle, endAngle);
            cooldownGraphics.closePath();
            cooldownGraphics.fillPath();
            
            // 쿨타임 중일 때는 번호 색상을 어둡게
            numberText.setStyle({ fill: '#888888' });
        } else {
            // 쿨타임이 끝났을 때
            cooldownGraphics.clear();
            cooldownGraphics.fillStyle(0x0066ff, 0.8);
            cooldownGraphics.fillCircle(x, y, radius);
            
            // 사용 가능할 때는 번호 색상을 밝게
            numberText.setStyle({ fill: '#ffffff' });
        }
    }
    
    update(time, delta) {
        // 다른 플레이어는 입력 처리하지 않음
        if (!this.isOtherPlayer) {
            if(!this.isJumping) {
                this.handleMovement();
            }
            this.handleSkills();
            this.updateStealth(delta);
            this.updateCooldowns(delta);
            
            // 스킬 쿨타임 UI 업데이트
            this.updateSkillCooldownUI();
            
            // 위치 변화가 있으면 서버에 전송 (점프 중이 아닐 때만)
            if (this.networkManager && !this.isJumping && (this.lastNetworkX !== this.x || this.lastNetworkY !== this.y || this.lastNetworkDirection !== this.direction)) {
                this.networkManager.updatePlayerPosition(this.x, this.y, this.direction, false);
                this.lastNetworkX = this.x;
                this.lastNetworkY = this.y;
                this.lastNetworkDirection = this.direction;
            }
        }
        
        // 이름 텍스트 위치 즉시 업데이트 (딜레이 최소화)
        this.updateNameTextPosition();
    }
    
    handleMovement() {
        const speed = this.speed;
        this.setVelocity(0);
        
        // 방향 감지
        let movingUp = false;
        let movingDown = false;
        let movingLeft = false;
        let movingRight = false;
        
        // WASD 또는 방향키로 이동
        if (this.wasd.W.isDown || this.cursors.up.isDown) {
            this.setVelocityY(-speed);
            movingUp = true;
        }
        if (this.wasd.S.isDown || this.cursors.down.isDown) {
            this.setVelocityY(speed);
            movingDown = true;
        }
        if (this.wasd.A.isDown || this.cursors.left.isDown) {
            this.setVelocityX(-speed);
            movingLeft = true;
        }
        if (this.wasd.D.isDown || this.cursors.right.isDown) {
            this.setVelocityX(speed);
            movingRight = true;
        }
        
        // 대각선 이동 정규화
        if (this.body.velocity.x !== 0 && this.body.velocity.y !== 0) {
            this.body.velocity.normalize().scale(speed);
        }
        
        // 방향 업데이트
        this.updateDirection(movingUp, movingDown, movingLeft, movingRight);
    }

        /****************************************************************
     * 물리 충돌 프로세스 콜백 (가장 정확한 벽 슬라이딩 처리)
     * @param {Player} player - 플레이어 객체 (자기 자신)
     * @param {Phaser.Tilemaps.Tile} wall - 충돌한 벽 타일
     * @returns {boolean} - true: 충돌 처리, false: 충돌 무시
     ****************************************************************/
        handleWallCollision(player, wall) {
            // body가 없으면 기본 충돌 처리
            const body = player.body;
            if (!body) {
                return true;
            }
    
            // 1. 설정: slideThreshold는 보정을 허용할 최대 겹침 깊이입니다.
            // 이 값보다 더 많이 겹치면 일반적인 '벽에 막힘'으로 처리됩니다.
            const slideThreshold = 10; // 10픽셀 이하로 겹쳤을 때만 슬라이딩 허용
    
            // 2. 현재 이동 방향 및 속도 확인
            const velocity = body.velocity;
    
            // 3. 겹침 영역 계산
            // 플레이어의 바디와 벽 타일의 경계가 겹치는 사각형을 계산합니다.
            const intersection = Phaser.Geom.Intersects.GetRectangleIntersection(body, wall.getBounds());
            const overlapX = intersection.width;
            const overlapY = intersection.height;
    
            if (velocity.x !== 0 && overlapY > 0 && overlapY < slideThreshold) {
                if (body.y < wall.y) {
                    player.y -= overlapY;
                } else {
                    player.y += overlapY;
                }
                return false;
            }
    
            if (velocity.y !== 0 && overlapX > 0 && overlapX < slideThreshold) {
                if (body.x < wall.x) {
                    player.x -= overlapX;
                } else {
                    player.x += overlapX;
                }
                return false;
            }
            
            return true;
        }
    
    updateDirection(movingUp, movingDown, movingLeft, movingRight) {
        // 움직이고 있는지 확인
        const isMoving = movingUp || movingDown || movingLeft || movingRight;
        
        if (isMoving) {
            // 우선순위: 위 > 아래 > 왼쪽 > 오른쪽
            if (movingUp) {
                this.direction = 'back';
            } else if (movingDown) {
                this.direction = 'front';
            } else if (movingLeft) {
                this.direction = 'left';
            } else if (movingRight) {
                this.direction = 'right';
            }
        }
        // 움직이지 않을 때는 마지막 방향을 유지 (스프라이트 변경하지 않음)
        
        // 방향이 바뀌었으면 스프라이트 업데이트
        if (this.direction !== this.lastDirection) {
            this.updateJobSprite();
            this.lastDirection = this.direction;
        }
    }
    
    handleSkills() {
        // 스페이스바로 점프
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.jump();
        }

        if (Phaser.Input.Keyboard.JustDown(this.qKey)) {
            this.useSkill(1);
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
            this.useSkill(2);
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.useSkill(3);
        }

        // 스페이스바로 점프
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.useJump();
        }
        
        // F키로 전직
        if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
            this.showJobSelection();
        }
      
        if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
            this.toggleInvincible();
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.lKey)) {
            this.testLevelUp();
        }
    }
  
    jump() {
        // 이미 점프 중이거나 다른 플레이어면 실행하지 않음
        if (this.isJumping || this.isOtherPlayer) {
            return;
        }
        
        // 기본 슬라임 스킬 - 점프 (로컬에서만 실행)
        const originalY = this.y; // 원래 Y 위치 저장
        const originalNameY = this.nameText ? this.nameText.y : null; // 이름표 원래 위치 저장
        this.setVelocity(0);
        this.isJumping = true; // 점프 시작
        
        // 플레이어와 이름표를 함께 애니메이션
        const targets = [this];
        if (this.nameText) {
            targets.push(this.nameText);
        }
        
        this.scene.tweens.add({
            targets: targets,
            y: originalY - 50,
            duration: 200,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                // 점프 완료 후 정확한 위치로 복원
                this.y = originalY;
                if (this.nameText && originalNameY !== null) {
                    this.nameText.y = originalNameY;
                }
                this.isJumping = false;
                
                // 점프 완료 후 서버에 위치 동기화 (점프 상태는 false로)
                if (this.networkManager) {
                    this.networkManager.updatePlayerPosition(this.x, this.y, this.direction, false);
                }
            }
        });

        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('jump');
        }
    }
    
    useSkill(skillNumber = 1) {
        switch (this.jobClass) {
            case 'assassin':
            case 'ninja':
                this.useStealth();
                break;
            case 'warrior':
                this.useCharge();
                break;
            case 'mage':
                // 마법사는 1번키로 와드, 2번키로 얼음장판, 3번키로 마법투사체
                switch (skillNumber) {
                    case 1:
                        this.useMageWard();
                        break;
                    case 2:
                        this.useMageIceField();
                        break;
                    case 3:
                        this.useMageMagicMissile();
                        break;
                }
                break;
            case 'mechanic':
                this.useMechanicSkill();
                break;
            default:
                this.useSlimeSkill();
                break;
        }
    }
    
    useStealth() {
        if (this.stealthCooldown <= 0) {
            this.isStealth = true;
            this.stealthDuration = 3000; // 3초
            this.stealthCooldown = 10000; // 10초 쿨타임
            this.stealthBonusDamage = 50;
            this.setAlpha(0.3);
            this.setTint(0x888888);
            if (this.networkManager && !this.isOtherPlayer) {
                this.networkManager.useSkill('stealth');
            }
        }
    }
    
    useCharge() {
        return;

        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('charge');
        }
    }
    
    useMageWard() {
        // 쿨타임 체크
        const now = this.scene.time.now;
        if (now < this.mageWardCooldown) {
            this.showCooldownMessage();
            return;
        }
        
        // 이미 와드가 설치되어 있으면 중복 설치 방지
        if (this.scene.activeWard) {
            this.showCooldownMessage();
            return;
        }
        
        // 쿨타임 갱신
        this.mageWardCooldown = now + this.MAGE_WARD_COOLDOWN;
        
        // 마법사의 와드 생성 (스프라이트 사용)
        const ward = this.scene.add.sprite(this.x, this.y, 'ward');
        ward.setScale(0.02); // 크기 조정 (필요시 조정)
        
        // 와드에 물리 바디 추가 (충돌을 위해)
        this.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(50, 50); // 충돌 크기 설정
        
        // 와드 체력 시스템 (슬라임 공격 2번 = 40 데미지)
        ward.hp = 40;
        ward.maxHp = 40;
        
        // 와드 설치 위치와 반지름을 GameScene의 activeWard에 저장
        this.scene.activeWard = { 
            x: this.x, 
            y: this.y, 
            radius: 120,
            sprite: ward,
            hp: ward.hp,
            maxHp: ward.maxHp
        };
        
        // 와드 이펙트 (깜빡이는 효과)
        this.scene.tweens.add({
            targets: ward,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // 와드 범위 내 적 탐지 및 알림 (체력이 0이 될 때까지 계속)
        const wardDetection = this.scene.time.addEvent({
            delay: 1000, // 1초마다 체크
            callback: () => {
                // 와드가 파괴되었으면 탐지 중단
                if (!ward.active || ward.hp <= 0) {
                    wardDetection.destroy();
                    return;
                }
                
                // 와드 범위 내 적 탐지
                try {
                    this.scene.enemies.getChildren().forEach(enemy => {
                        if (enemy && !enemy.isDead) {
                            const distance = Phaser.Math.Distance.Between(ward.x, ward.y, enemy.x, enemy.y);
                            if (distance <= 120) {
                                // 적이 와드 범위에 들어오면 시각적 알림
                                if (!enemy.wardDetected) {
                                    enemy.wardDetected = true;
                                    // 적에게 빨간색 틴트 효과
                                    enemy.setTint(0xff0000);
                                    
                                    // 시야 밖에서도 보이게 하기 위해 투명도 조정
                                    enemy.setAlpha(0.8);
                                    
                                    // 디버깅: 와드 탐지 로그
                                    console.log('와드 탐지됨:', enemy.x, enemy.y, '거리:', distance);
                                    
                                    // 미니맵에 적 표시
                                    this.showEnemyOnMinimap(enemy);
                                }
                            } else {
                                // 범위 밖으로 나가면 탐지 해제
                                if (enemy.wardDetected) {
                                    enemy.clearTint();
                                    enemy.wardDetected = false;
                                    enemy.setAlpha(1.0); // 원래 투명도로 복원
                                    
                                    // 미니맵에서 적 표시 제거
                                    this.hideEnemyFromMinimap(enemy);
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('와드 탐지 중 오류:', error);
                    wardDetection.destroy();
                }
            },
            loop: true
        });
        
        // 와드 파괴 함수 정의
        const destroyWard = () => {
            // 와드 제거
            if (ward.active) {
                ward.destroy();
            }
            
            // 탐지 이벤트 제거
            if (wardDetection) {
                wardDetection.destroy();
            }
            
            // 모든 적의 와드 탐지 상태 초기화
            try {
                this.scene.enemies.getChildren().forEach(enemy => {
                    if (enemy && enemy.wardDetected) {
                        enemy.clearTint();
                        enemy.wardDetected = false;
                        enemy.setAlpha(1.0);
                        this.hideEnemyFromMinimap(enemy);
                    }
                });
            } catch (error) {
                console.error('와드 정리 중 오류:', error);
            }
            
            // 와드 설치 위치 정보 제거
            this.scene.activeWard = null;
        };
        
        // 와드에 파괴 함수 연결
        ward.destroyWard = destroyWard;
        
        // 와드 설치 후 충돌 설정 업데이트
        this.scene.setupCollisions();

        // 네트워크 동기화
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('ward');
        }
    }
    
    // 미니맵에 적 표시 (와드 탐지용)
    showEnemyOnMinimap(enemy) {
        // 이미 미니맵에 표시되어 있으면 중복 생성 방지
        if (enemy.minimapIndicator) {
            console.log('이미 미니맵에 표시됨');
            return;
        }
        
        // 미니맵 위치 확인
        if (!this.scene.minimap) {
            console.log('미니맵이 없음');
            return;
        }
        
        console.log('미니맵 위치:', this.scene.minimap.x, this.scene.minimap.y);
        
        // 미니맵에 빨간색 점으로 적 표시
        const scale = this.scene.minimapScale;
        const offsetX = this.x - (this.scene.minimapSize / 2) / scale;
        const offsetY = this.y - (this.scene.minimapSize / 2) / scale;
        
        const minimapX = (enemy.x - offsetX) * scale;
        const minimapY = (enemy.y - offsetY) * scale;
        
        // 미니맵 경계 내로 제한
        const clampedX = Math.max(0, Math.min(this.scene.minimapSize, minimapX));
        const clampedY = Math.max(0, Math.min(this.scene.minimapSize, minimapY));
        
        const minimapEnemy = this.scene.add.circle(
            this.scene.minimap.x + clampedX,
            this.scene.minimap.y + clampedY,
            3, // 적당한 크기
            0xff0000, 
            1.0
        );
        minimapEnemy.setScrollFactor(0);
        minimapEnemy.setDepth(1004); // 미니맵 위에 표시
        
        // 적 객체에 미니맵 표시 참조 저장
        enemy.minimapIndicator = minimapEnemy;
        
        // 깜빡이는 효과
        this.scene.tweens.add({
            targets: minimapEnemy,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 디버깅: 콘솔에 로그 출력
        console.log('미니맵에 적 표시됨:', enemy.x, enemy.y, '화면 중앙에 표시');
    }
    
    // 미니맵에서 적 표시 제거
    hideEnemyFromMinimap(enemy) {
        if (enemy.minimapIndicator) {
            enemy.minimapIndicator.destroy();
            enemy.minimapIndicator = null;
        }
    }
    
    useMageIceField() {
        // 쿨타임 체크
        const now = this.scene.time.now;
        if (now < this.mageIceFieldCooldown) {
            this.showCooldownMessage();
            return;
        }
        
        // 쿨타임 갱신
        this.mageIceFieldCooldown = now + this.MAGE_ICE_FIELD_COOLDOWN;
        
        // 얼음 장판 생성 (범위 내 적 슬로우 효과)
        const iceField = this.scene.add.circle(this.x, this.y, 100, 0x87ceeb, 0.4);
        this.scene.physics.add.existing(iceField);
        iceField.body.setImmovable(true);
        
        // 얼음 장판 이펙트
        this.scene.tweens.add({
            targets: iceField,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 2000,
            yoyo: true,
            repeat: 2
        });
        
        // 범위 내 적들에게 슬로우 효과 적용
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance <= 100) {
                    // 적의 속도를 50% 감소
                    const originalSpeed = enemy.speed || 100;
                    enemy.speed = originalSpeed * 0.5;
                    
                    // 3초 후 속도 복원
                    this.scene.time.delayedCall(3000, () => {
                        if (enemy && !enemy.isDead) {
                            enemy.speed = originalSpeed;
                        }
                    });
                    
                    // 슬로우 시각적 효과
                    enemy.setTint(0x87ceeb);
                    this.scene.time.delayedCall(3000, () => {
                        if (enemy && !enemy.isDead) {
                            enemy.clearTint();
                        }
                    });
                }
            }
        });
        
        // 6초 후 얼음 장판 제거
        this.scene.time.delayedCall(6000, () => {
            iceField.destroy();
        });

        // 네트워크 동기화
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('ice_field');
        }
    }
    
    useMageMagicMissile() {
        // 쿨타임 체크
        const now = this.scene.time.now;
        if (now < this.mageMagicMissileCooldown) {
            this.showCooldownMessage();
            return;
        }
        
        // 쿨타임 갱신
        this.mageMagicMissileCooldown = now + this.MAGE_MAGIC_MISSILE_COOLDOWN;
        
        // 마우스 커서의 월드 좌표 가져오기
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // 플레이어와 마우스 커서 사이의 거리 계산
        const initialDistance = Phaser.Math.Distance.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        const maxRange = 400; // 최대 사거리
        
        // 사거리 내에 있는지 확인
        if (initialDistance > maxRange) {
            // 사거리 밖이면 최대 사거리만큼만 발사
            const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
            worldPoint.x = this.x + Math.cos(angle) * maxRange;
            worldPoint.y = this.y + Math.sin(angle) * maxRange;
        }
        
        // 마법 투사체 생성
        const missile = this.scene.add.circle(this.x, this.y, 8, 0xff00ff, 1);
        this.scene.physics.add.existing(missile);
        missile.team = this.team; // 팀 정보 저장 (충돌 판정용)
        
        // 투사체 이동 방향 계산 (마우스 커서 방향)
        const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        const velocity = 400; // 투사체 속도
        
        // tween 방식으로 이동 (다른 플레이어와 동일하게)
        const distance = Phaser.Math.Distance.Between(this.x, this.y, worldPoint.x, worldPoint.y);
        const duration = (distance / velocity) * 1000; // 밀리초 단위로 변환
        
        this.scene.tweens.add({
            targets: missile,
            x: worldPoint.x,
            y: worldPoint.y,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                // 최종 목표 지점에서 폭발 이펙트
                this.createMagicExplosion(worldPoint.x, worldPoint.y);
                missile.destroy();
            }
        });
        
        // 투사체 이펙트
        this.scene.tweens.add({
            targets: missile,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        // 투사체와 적 충돌 체크
        this.scene.physics.add.overlap(missile, this.scene.enemies, (missile, enemy) => {
            // 서버에 적 공격 알림 (서버에서 관리되는 적이므로)
            if (this.networkManager && enemy.networkId) {
                this.networkManager.hitEnemy(enemy.networkId);
            }
            
            // 폭발 이펙트
            this.createMagicExplosion(missile.x, missile.y);
            
            missile.destroy();
        });
        
        // 투사체와 벽 충돌 체크
        this.scene.physics.add.collider(missile, this.scene.walls, (missile, wall) => {
            // 벽에 부딪혔을 때 폭발 이펙트
            this.createMagicExplosion(missile.x, missile.y);
            
            missile.destroy();
        });
        
        // tween 방식으로 이동하므로 distanceCheck 로직 제거 (onComplete에서 처리)

        // 네트워크 동기화 (투사체 궤적 정보 포함)
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('magic_missile', {
                startX: this.x,
                startY: this.y,
                targetX: worldPoint.x,
                targetY: worldPoint.y,
                maxRange: maxRange // 사거리 정보 추가
            });
        }
    }
    
    // 마법 폭발 이펙트 생성 (공통 함수)
    createMagicExplosion(x, y) {
        const explosion = this.scene.add.circle(x, y, 20, 0xff00ff, 0.8);
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                explosion.destroy();
            }
        });
    }
    
    useSlimeSkill() {
        // 쿨타임(단위: ms)
        const skillCooldown = this.SLIME_SPREAD_COOLDOWN;
        if (!this.slimeSkillCooldown) this.slimeSkillCooldown = 0;
        const now = this.scene.time.now;
        // 쿨타임 중이면 발동 불가
        if (now < this.slimeSkillCooldown) {
            this.showCooldownMessage();
            return;
        }
        // 이미 스킬 사용 중이거나 다른 플레이어면 실행하지 않음
        if (this.isJumping || this.isOtherPlayer) {
            return;
        }
        // 쿨타임 갱신
        this.slimeSkillCooldown = now + skillCooldown;
        // 슬라임 스킬: 퍼지기(범위 공격)
        const range = 50; // 공격 범위 반지름(px)
        const damage = this.getAttackDamage(); // 플레이어의 공격력
        this.isJumping = true; // 스킬 사용 중 상태(애니메이션 중 중복 방지)
        // 스킬 사용 시 플레이어 멈춤
        this.setVelocity(0);
        // 슬라임 퍼지기 스프라이트 적용
        const originalTexture = this.texture.key;
        this.setTexture('slime_skill');
        // 시각적 이펙트(원형 범위 표시)
        const effect = this.scene.add.circle(this.x, this.y, range, 0x00ff00, 0.3);
        this.scene.time.delayedCall(300, () => {
            effect.destroy();
        });
        // 범위 내 적 탐색 및 데미지 적용
        this.scene.enemies.getChildren().forEach(enemy => {
            if (!enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance <= range) {
                    enemy.takeDamage(damage);
                }
            }
        });
        // 스킬 사용 후 약간의 딜레이(쿨타임 대용, 점프 애니메이션 대체)
        this.scene.time.delayedCall(400, () => {
            this.isJumping = false;
            // 원래 스프라이트로 복원
            this.updateJobSprite();
        });
        // 네트워크 동기화
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('slime_spread');
        }
    }
    
    useMechanicSkill() {
        // 기본 메카닉 스킬 - 아직 구현되지 않음
        this.scene.add.text(this.x, this.y - 60, '메카닉 스킬!', {
            fontSize: '16px',
            fill: '#ff6600'
        }).setOrigin(0.5);
        
        // 1초 후 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            this.scene.children.list.forEach(child => {
                if (child.type === 'Text' && child.text === '메카닉 스킬!') {
                    child.destroy();
                }
            });
        });

        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.useSkill('mechanic');
        }
    }
    
    updateStealth(delta) {
        if (this.isStealth) {
            this.stealthDuration -= delta;
            if (this.stealthDuration <= 0) {
                this.isStealth = false;
                this.stealthBonusDamage = 0;
                this.setAlpha(1);
                this.updateJobSprite();
            }
        }
    }
    
    updateCooldowns(delta) {
        if (this.stealthCooldown > 0) {
            this.stealthCooldown -= delta;
        }
    }
    
    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.levelUp();
        }
        this.updateUI();
    }
    
    levelUp() {
        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.2);
        
        // 스탯 증가
        this.maxHp += 20;
        this.hp = this.maxHp;
        this.attack += 5;
        this.defense += 2;
        this.speed += 10;
        
        // 모든 직업이 레벨에 따라 크기 증가
        this.updateCharacterSize();
        
        // 레벨업 효과
        const levelUpText = this.scene.add.text(this.x, this.y - 50, 'LEVEL UP!', {
            fontSize: '24px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // 2초 후 레벨업 메시지 제거
        this.scene.time.delayedCall(2000, () => {
            levelUpText.destroy();
        });
        
        this.updateUI();
    }
    
    changeJob(jobClass) {
        this.jobClass = jobClass;
        this.jobLevel = 1;
        this.updateJobSprite();
        this.updateUI();
        
        // 직업 변경 시 스킬 쿨타임 UI 재생성 (마법사는 3개, 다른 직업은 1개)
        if (!this.isOtherPlayer) {
            this.createSkillCooldownUI();
        }
        
        // 네트워크로 직업 변경 알림 (다른 플레이어가 아닐 때만)
        if (this.networkManager && !this.isOtherPlayer) {
            this.networkManager.changeJob(jobClass);
        }
    }
    
    updateJobSprite() {
        // 직업과 방향에 따른 스프라이트 변경
        const spriteKey = AssetLoader.getPlayerSpriteKey(this.jobClass, this.direction);
        
        // 텍스처 존재 여부 확인
        if (this.scene.textures.exists(spriteKey)) {
            this.setTexture(spriteKey);
        } else {
            console.warn(`텍스처가 존재하지 않음: ${spriteKey}`);
            // 폴백: 기본 슬라임 텍스처 사용
            const fallbackKey = 'player_slime_front';
            if (this.scene.textures.exists(fallbackKey)) {
                console.log(`폴백 텍스처 사용: ${fallbackKey}`);
                this.setTexture(fallbackKey);
            } else {
                console.error('폴백 텍스처도 없음! 기본 텍스처 생성 필요');
                // 마지막 폴백: 기본 사각형 생성
                this.createFallbackTexture();
            }
        }
        
        // 스프라이트 변경 후 크기 재조정 (레벨에 따른 크기도 함께 적용)
        this.updateCharacterSize();
        
        // 애니메이션 재생은 제거 (스프라이트만 업데이트)
    }
    
    // 긴급 폴백 텍스처 생성
    createFallbackTexture() {
        const fallbackKey = 'player_fallback';
        if (!this.scene.textures.exists(fallbackKey)) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0x00ff00); // 초록색 사각형
            graphics.fillRect(0, 0, 64, 64);
            graphics.generateTexture(fallbackKey, 64, 64);
            graphics.destroy();
        }
        this.setTexture(fallbackKey);
        console.log('긴급 폴백 텍스처 생성 및 설정 완료');
    }
    
    // 무적 모드 토글
    toggleInvincible() {
        this.isInvincible = !this.isInvincible;
        
        if (this.isInvincible) {
            // 무적 모드 ON - 색상 변경 없이 메시지만 표시
            const invincibleText = this.scene.add.text(this.x, this.y - 80, '무적 모드 ON', {
                fontSize: '16px',
                fill: '#00ff00'
            }).setOrigin(0.5);
            
            // 1초 후 메시지 제거
            this.scene.time.delayedCall(1000, () => {
                invincibleText.destroy();
            });
        } else {
            // 무적 모드 OFF - 메시지만 표시
            this.updateJobSprite(); // 원래 스프라이트로 복원
            const invincibleText = this.scene.add.text(this.x, this.y - 80, '무적 모드 OFF', {
                fontSize: '16px',
                fill: '#ff0000'
            }).setOrigin(0.5);
            
            // 2초 후 메시지 제거
            this.scene.time.delayedCall(2000, () => {
                invincibleText.destroy();
            });
        }
        
        this.updateUI();
    }
    
    // 레벨업 테스트
    testLevelUp() {
        this.gainExp(this.expToNext); // 바로 레벨업할 수 있는 경험치 추가
        const testText = this.scene.add.text(this.x, this.y - 100, '레벨업 테스트!', {
            fontSize: '20px',
            fill: '#ffff00'
        }).setOrigin(0.5);
        
        // 1초 후 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            testText.destroy();
        });
    }
    
    // 캐릭터 크기를 레벨에 따라 업데이트하는 메서드
    updateCharacterSize() {
        // 모든 직업이 동일한 성장률과 최대 크기를 가짐
        const baseSize = 16;        // 기본 크기 (레벨 1)
        const growthRate = 1;       // 레벨당 증가 크기
        const maxSize = 40;        // 최대 크기
        
        // 레벨에 따른 크기 계산
        const targetSize = baseSize + (this.level - 1) * growthRate;
        const finalSize = Math.min(targetSize, maxSize);
        
        // this.size 속성 업데이트 (다른 메서드들과 동기화)
        this.size = finalSize;
        
        // 캐릭터 크기 조정 (정사각형 유지)
        AssetLoader.adjustSpriteSize(this, finalSize, finalSize);
        
        // 충돌 박스는 updateSize() 메서드에서 통합 관리
        this.updateSize();
    }
    
    showJobSelection() {
        // 간단한 전직 UI (실제로는 더 복잡하게 구현)
        const jobs = ['slime', 'assassin', 'ninja', 'warrior', 'mage', 'mechanic'];
        const currentIndex = jobs.indexOf(this.jobClass);
        const nextIndex = (currentIndex + 1) % jobs.length;
        this.changeJob(jobs[nextIndex]);
    }
    
    takeDamage(damage) {
        // 무적 모드일 때는 데미지를 받지 않음
        if (this.isInvincible) {
            const invincibleText = this.scene.add.text(this.x, this.y - 30, '무적!', {
                fontSize: '16px',
                fill: '#00ff00'
            }).setOrigin(0.5);
            
            // 1초 후 메시지 제거
            this.scene.time.delayedCall(1000, () => {
                invincibleText.destroy();
            });
            return;
        }
        
        const actualDamage = Math.max(1, damage - this.defense);
        this.hp = Math.max(0, this.hp - actualDamage);
        
        // 데미지 표시
        const damageText = this.scene.add.text(this.x, this.y - 30, `-${actualDamage}`, {
            fontSize: '16px',
            fill: '#ff0000'
        }).setOrigin(0.5);
        
        // 1초 후 데미지 메시지 제거
        this.scene.time.delayedCall(1000, () => {
            damageText.destroy();
        });
        
        this.updateUI();
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    die() {
        this.scene.scene.restart();
    }
    
    updateUI() {
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.textContent = `레벨: ${this.level} | HP: ${this.hp}/${this.maxHp} | 직업: ${JobClasses[this.jobClass]?.name || '슬라임'}`;
        }
    }
    
    getAttackDamage() {
        let damage = this.attack;
        if (this.isStealth && this.stealthBonusDamage > 0) {
            damage += this.stealthBonusDamage;
            this.stealthBonusDamage = 0; // 한 번만 적용
        }
        return damage;
    }

    // 네트워크 ID 설정
    setNetworkId(id) {
        this.networkId = id;
    }

    // 네트워크 매니저 설정
    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
        this.lastNetworkX = this.x;
        this.lastNetworkY = this.y;
        this.lastNetworkDirection = this.direction;
    }

    setIsOtherPlayer(isOther) {
        this.isOtherPlayer = isOther;
    }

    updateFromNetwork(data) {
        // setPosition을 사용해서 이름표도 함께 업데이트
        this.setPosition(data.x, data.y);
        this.direction = data.direction;
        this.isJumping = data.isJumping;
        this.updateJobSprite();
    }

    // 속도 부스트 활성화 (치트)
    activateSpeedBoost(multiplier) {
        if (!this.originalSpeed) {
            this.originalSpeed = this.speed;
        }
        this.speed = this.originalSpeed * multiplier;
        console.log(`속도 부스트 활성화: ${this.originalSpeed} -> ${this.speed}`);
    }
    
    // 속도 부스트 비활성화 (치트)
    deactivateSpeedBoost() {
        if (this.originalSpeed) {
            this.speed = this.originalSpeed;
            console.log(`속도 부스트 비활성화: ${this.speed}`);
        }
    }

    suicide() {
        this.die();
    }

    // 이름표 생성 메서드
    createNameText(nickname, team = this.team, depth) {
        if (this.nameText) {
            this.nameText.destroy();
        }
        
        const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
        const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
        
        // 이름표 생성 (플레이어 위치 기준)
        this.nameText = this.scene.add.text(this.x, this.y - 40, displayName, {
            fontSize: '12px',
            fill: teamColor,
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        this.nameText.setDepth(depth); // 이름 텍스트는 플레이어보다도 위에
        
        return this.nameText;
    }
    
    // 이름표 위치 즉시 업데이트 메서드
    updateNameTextPosition() {
        if (this.nameText) {
            this.nameText.setPosition(this.x, this.y - 40);
        }
    }
    
    // 닉네임 업데이트
    updateNickname(nickname) {
        if (this.nameText) {
            const displayName = nickname || `Player ${this.networkId ? this.networkId.slice(0, 6) : 'Unknown'}`;
            this.nameText.setText(displayName);
        }
    }
    
    // 팀 색깔 업데이트
    updateTeamColor(team = this.team) {
        if (this.nameText) {
            const teamColor = team === 'red' ? '#ff4444' : '#4444ff';
            this.nameText.setColor(teamColor);
        }
    }
    
    // 위치 설정 오버라이드 (이름표 자동 동기화)
    setPosition(x, y) {
        super.setPosition(x, y);
        this.updateNameTextPosition();
        return this;
    }
    
    // x 좌표만 설정
    setX(x) {
        super.setX(x);
        this.updateNameTextPosition();
        return this;
    }
    
    // y 좌표만 설정
    setY(y) {
        super.setY(y);
        this.updateNameTextPosition();
        return this;
    }

    // 이름 텍스트 제거
    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        
        // 스킬 쿨타임 UI 제거
        if (this.skillCooldownUI) {
            this.skillCooldownUI.background.destroy();
            this.skillCooldownUI.cooldown.destroy();
            this.skillCooldownUI.number.destroy();
        }
        
        super.destroy();
    }
} 