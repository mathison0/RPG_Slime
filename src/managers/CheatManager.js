/**
 * 치트 관리 매니저
 * 디버그 치트 키들을 관리합니다.
 */
export default class CheatManager {
    constructor(scene) {
        this.scene = scene;
        
        // 치트 상태
        this.isSpeedBoostActive = false;
        
        // 키 바인딩
        this.cheatKeys = {};
        
        this.setupCheatKeys();
    }

    /**
     * 치트 키 설정
     */
    setupCheatKeys() {
        this.cheatKeys = {
            o: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O),
            p: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P),
            shift: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            one: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            two: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            three: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
            four: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
            zero: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO)
        };
        
        console.log('디버그 치트 키 활성화됨:');
        console.log('O - 전체 맵 발견 처리');
        console.log('P - 자살 (리스폰)');
        console.log('Shift - 속도 부스트 (누르고 있기)');
        console.log('1,2,3,4 - 맵 꼭짓점으로 이동');
        console.log('0 - 광장 중앙으로 이동');
    }

    /**
     * 치트 키 처리
     */
    handleCheatKeys() {
        if (!this.cheatKeys || !this.scene.player) return;
        
        // O - 전체 맵 발견 처리
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.o)) {
            this.revealEntireMap();
        }
        
        // P - 자살 (리스폰)
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.p)) {
            console.log('자살 치트 사용 - 리스폰');
            this.scene.player.suicide();
        }
        
        // Shift - 속도 부스트
        if (this.cheatKeys.shift.isDown) {
            if (!this.isSpeedBoostActive) {
                this.isSpeedBoostActive = true;
                this.scene.player.activateSpeedBoost(3); // 3배 속도
            }
        } else {
            if (this.isSpeedBoostActive) {
                this.isSpeedBoostActive = false;
                this.scene.player.deactivateSpeedBoost();
            }
        }
        
        // 1,2,3,4 - 맵 꼭짓점으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.one)) {
            this.teleportToCorner(1); // 좌상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.two)) {
            this.teleportToCorner(2); // 우상단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.three)) {
            this.teleportToCorner(3); // 좌하단
        }
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.four)) {
            this.teleportToCorner(4); // 우하단
        }
        
        // 0 - 광장 중앙으로 이동
        if (Phaser.Input.Keyboard.JustDown(this.cheatKeys.zero)) {
            this.teleportToPlaza();
        }
    }

    /**
     * 전체 맵 발견 처리 (치트)
     */
    revealEntireMap() {
        if (this.scene.minimapManager) {
            this.scene.minimapManager.revealEntireMap();
        }
    }

    /**
     * 맵 꼭짓점으로 텔레포트
     */
    teleportToCorner(corner) {
        if (!this.scene.player) return;
        
        let x, y;
        const margin = this.scene.SPAWN_WIDTH + 100; // 스폰 구역 밖으로
        
        switch(corner) {
            case 1: // 좌상단
                x = margin;
                y = 100;
                break;
            case 2: // 우상단
                x = this.scene.MAP_WIDTH - margin;
                y = 100;
                break;
            case 3: // 좌하단
                x = margin;
                y = this.scene.MAP_HEIGHT - 100;
                break;
            case 4: // 우하단
                x = this.scene.MAP_WIDTH - margin;
                y = this.scene.MAP_HEIGHT - 100;
                break;
        }
        
        console.log(`텔레포트: 꼭짓점 ${corner} (${x}, ${y})`);
        this.scene.player.x = x;
        this.scene.player.y = y;
    }

    /**
     * 광장 중앙으로 텔레포트
     */
    teleportToPlaza() {
        if (!this.scene.player) return;
        
        const x = this.scene.PLAZA_X + this.scene.PLAZA_SIZE / 2;
        const y = this.scene.PLAZA_Y + this.scene.PLAZA_SIZE / 2;
        
        console.log(`텔레포트: 광장 중앙 (${x}, ${y})`);
        this.scene.player.x = x;
        this.scene.player.y = y;
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.cheatKeys = {};
        this.isSpeedBoostActive = false;
    }
} 