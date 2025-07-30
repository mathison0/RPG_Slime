import BaseJob from './BaseJob.js';

/**
 * 지원자 직업 클래스
 */
export default class SupporterJob extends BaseJob {
    constructor(player) {
        super(player);
    }

    /**
     * 지원자 기본 공격 이펙트 (녹색 부채꼴)
     */
    showBasicAttackEffect(targetX, targetY) {
        // 부채꼴 공격 범위 설정
        const attackRange = 55;
        const angleOffset = Math.PI / 6; // 30도 (π/6)
        
        // 플레이어에서 마우스 커서까지의 각도 계산
        const centerX = this.player.x;
        const centerY = this.player.y;
        const angleToMouse = Phaser.Math.Angle.Between(centerX, centerY, targetX, targetY);
        
        // 부채꼴의 시작과 끝 각도 계산
        const startAngle = angleToMouse - angleOffset;
        const endAngle = angleToMouse + angleOffset;
        
        // 지원자 근접 공격 이펙트 (녹색 부채꼴)
        const graphics = this.player.scene.add.graphics();
        graphics.fillStyle(0x00ff00, 0.8); // 녹색
        graphics.lineStyle(3, 0x00ff00, 1);
        
        // 부채꼴 그리기
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.arc(centerX, centerY, attackRange, startAngle, endAngle);
        graphics.closePath();
        graphics.fill();
        graphics.stroke();
        
        // 이펙트 애니메이션
        this.player.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 400,
            onComplete: () => {
                graphics.destroy();
            }
        });
    }

    /**
     * 와드 이펙트 (서버에서 스킬 승인 시 호출)
     */
    showWardEffect(data = null) {
        // 서버에서 받은 위치 정보 사용 (기본값: 플레이어 위치)
        const wardX = data?.x || this.player.x;
        const wardY = data?.y || this.player.y;
        
        // 와드 관리 배열 초기화 (없으면 생성)
        if (!this.player.scene.wardList) {
            this.player.scene.wardList = [];
        }
        
        // 다른 플레이어의 와드인지 확인 
        const isOtherPlayer = data?.playerId && data.playerId !== this.player.networkManager?.playerId;
        
        // 내 와드이고 최대 개수(2개)에 도달했다면 가장 오래된 와드 제거
        if (!isOtherPlayer && this.player.scene.wardList.length >= 2) {
            const oldestWard = this.player.scene.wardList.shift(); // 첫 번째 와드 제거
            if (oldestWard && oldestWard.sprite && oldestWard.sprite.active) {
                oldestWard.sprite.destroyWard();
            }
        }
        
        // 와드 생성
        const ward = this.player.scene.add.sprite(wardX, wardY, 'ward');
        
        // 서버에서 받은 크기 정보 사용 (기본값: 0.2)
        const wardScale = data?.wardScale || 0.2;
        const wardBodySize = data?.wardBodySize || 125;
        
        ward.setScale(wardScale);
        
        if (isOtherPlayer) {
            ward.isOtherPlayerWard = true;
            ward.wardOwnerId = data.playerId;
            ward.wardOwnerTeam = data.playerTeam; // 와드 소유자 팀 정보 저장
        }
        
        // 와드 depth 설정 (다른 팀 플레이어의 와드는 시야 그림자보다 낮게)
        if (isOtherPlayer) {
            ward.setDepth(999); // 시야 그림자(1000)보다 낮게
        } else {
            ward.setDepth(1001); // 자신의 와드는 기존과 동일
        }
        
        // 와드에 물리 바디 추가
        this.player.scene.physics.add.existing(ward);
        ward.body.setImmovable(true);
        ward.body.setSize(wardBodySize, wardBodySize);
        
        // 와드 체력 시스템
        ward.hp = 40;
        ward.maxHp = 40;
        
        // 서버에서 받은 스킬 정보 사용
        const skillInfo = data?.skillInfo || {};
        const range = skillInfo.range || 120; // 서버에서 받은 범위
        
        console.log(`와드 스킬 정보 (서버에서 받음): range=${range}`);
        
        // 와드 정보 저장
        const wardInfo = { 
            id: data?.wardId || Date.now(),
            x: wardX, 
            y: wardY, 
            radius: range,
            sprite: ward,
            hp: ward.hp,
            maxHp: ward.maxHp,
            ownerId: data?.playerId || this.player.networkId
        };
        
        // 내 와드인 경우에만 리스트에 추가
        if (!isOtherPlayer) {
            this.player.scene.wardList.push(wardInfo);
            // activeWard는 가장 최근 와드로 설정
            this.player.scene.activeWard = wardInfo;
        }
        
        // 와드 범위 표시 (하얀색 반투명 원형, 거의 투명)
        const rangeIndicator = this.player.scene.add.circle(ward.x, ward.y, range, 0xffffff, 0.1);
        if (isOtherPlayer) {
            rangeIndicator.setDepth(998); // 와드 스프라이트(999)보다 낮게
        } else {
            rangeIndicator.setDepth(1000); // 자신의 와드 범위는 기존과 동일
        }
        
        // 와드와 함께 파괴되도록 설정
        ward.rangeIndicator = rangeIndicator;
        
        // 와드 소유자 정보 설정 (서버에서 받은 설치자 ID 사용)
        ward.ownerId = data?.playerId || this.player.networkId;
        // 와드 ID 설정
        ward.wardId = data?.wardId || wardInfo.id;
        
        // 와드 파괴 함수
        const destroyWard = () => {
            if (ward.active) {
                // 범위 표시도 함께 제거
                if (ward.rangeIndicator) {
                    ward.rangeIndicator.destroy();
                }
                ward.destroy();
            }
            
            // 내 와드인 경우 리스트에서도 제거
            if (!isOtherPlayer && this.player.scene.wardList) {
                const index = this.player.scene.wardList.findIndex(w => w.id === wardInfo.id);
                if (index > -1) {
                    this.player.scene.wardList.splice(index, 1);
                }
                
                // activeWard 업데이트 (가장 최근 와드로)
                if (this.player.scene.wardList.length > 0) {
                    this.player.scene.activeWard = this.player.scene.wardList[this.player.scene.wardList.length - 1];
                } else {
                    this.player.scene.activeWard = null;
                }
            }
        };
        
        ward.destroyWard = destroyWard;
        
        this.player.scene.mapManager.setupCollisions();

        console.log(`와드 설치 완료! (현재 와드 개수: ${this.player.scene.wardList ? this.player.scene.wardList.length : 0})`);
    }

    /**
     * 쿨타임 정보 반환
     */
    getSkillCooldowns() {
        // 서버에서 받은 쿨타임 정보를 사용
        if (this.player.serverSkillCooldowns) {
            return this.player.serverSkillCooldowns;
        }
        return {};
    }

    /**
     * 지원자 스킬 사용
     */
    useSkill(skillNumber, options = {}) {
        if (this.player.isOtherPlayer || !this.player.networkManager) {
            return;
        }
        switch (skillNumber) {
            case 1: // Q키 - 와드 설치
                // 마우스 커서의 월드 좌표 가져오기
                const pointer = this.player.scene.input.activePointer;
                const worldPoint = this.player.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
                this.player.networkManager.useSkill('ward', worldPoint.x, worldPoint.y);
                break;
            case 2: // E키
                this.player.networkManager.useSkill('shield', {
                    targetX: this.scene.input.mousePointer.worldX,
                    targetY: this.scene.input.mousePointer.worldY
                });
                break;
            case 3: // R키
                this.player.networkManager.useSkill('blessing', {
                    targetX: this.scene.input.mousePointer.worldX,
                    targetY: this.scene.input.mousePointer.worldY
                });
                break;
            default:
                console.log('SupporterJob: 알 수 없는 스킬 번호:', skillNumber);
        }
    }
}
