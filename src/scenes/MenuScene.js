import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.playerNickname = '';
    }

    create() {
        const { width, height } = this.scale;
        
        // 타이틀
        this.add.text(width / 2, height / 4, 'RPG SLIME', {
            fontSize: '64px',
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 서브타이틀
        this.add.text(width / 2, height / 4 + 80, '멀티플레이어 RPG 게임', {
            fontSize: '24px',
            fill: '#ecf0f1',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 닉네임 입력 섹션
        this.createNicknameInput(width, height);

        // 조작법
        this.add.text(width / 2, height * 0.85, 'WASD: 이동 | SPACE: 스킬 | Q: 전직 | M: 맵', {
            fontSize: '16px',
            fill: '#95a5a6',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 추가 정보
        this.add.text(width / 2, height * 0.9, '여러 탭을 열어서 멀티플레이어를 테스트해보세요!', {
            fontSize: '14px',
            fill: '#7f8c8d',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
    }

    createNicknameInput(width, height) {
        // 닉네임 라벨
        this.add.text(width / 2, height / 2 - 60, '닉네임을 입력하세요', {
            fontSize: '24px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 닉네임 입력 박스 배경
        this.inputBox = this.add.rectangle(width / 2, height / 2, 300, 50, 0x34495e);
        this.inputBox.setStrokeStyle(2, 0x3498db);

        // 닉네임 텍스트
        this.nicknameText = this.add.text(width / 2, height / 2, '', {
            fontSize: '20px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 플레이스홀더 텍스트
        this.placeholderText = this.add.text(width / 2, height / 2, '여기에 닉네임 입력...', {
            fontSize: '18px',
            fill: '#7f8c8d',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 입력 박스 클릭 이벤트
        this.inputBox.setInteractive();
        this.inputBox.on('pointerdown', () => {
            this.focusInput();
        });

        // 커서 (깜빡이는 효과)
        this.cursor = this.add.text(width / 2, height / 2, '|', {
            fontSize: '20px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        this.cursor.setVisible(false);

        // 키보드 입력 이벤트
        this.input.keyboard.on('keydown', (event) => {
            this.handleKeyInput(event);
        });

        // 시작 버튼
        this.startButton = this.add.text(width / 2, height / 2 + 80, '게임 시작', {
            fontSize: '24px',
            fill: '#95a5a6',
            backgroundColor: '#2c3e50',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5);

        this.startButton.setInteractive();
        this.updateStartButton();

        // 랜덤 닉네임 버튼
        const randomButton = this.add.text(width / 2, height / 2 + 140, '랜덤 닉네임', {
            fontSize: '18px',
            fill: '#3498db',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        randomButton.setInteractive();
        randomButton.on('pointerdown', () => {
            this.generateRandomNickname();
        });
        randomButton.on('pointerover', () => {
            randomButton.setStyle({ fill: '#5dade2' });
        });
        randomButton.on('pointerout', () => {
            randomButton.setStyle({ fill: '#3498db' });
        });

        // 기본 포커스 설정
        this.focusInput();
    }

    focusInput() {
        this.inputBox.setStrokeStyle(2, 0x2ecc71);
        this.cursor.setVisible(true);
        
        // 커서 깜빡이 애니메이션
        this.tweens.add({
            targets: this.cursor,
            alpha: 0,
            duration: 530,
            yoyo: true,
            repeat: -1
        });
    }

    handleKeyInput(event) {
        if (event.keyCode === 8) { // Backspace
            if (this.playerNickname.length > 0) {
                this.playerNickname = this.playerNickname.slice(0, -1);
                this.updateNicknameDisplay();
            }
        } else if (event.keyCode === 13) { // Enter
            if (this.playerNickname.trim().length > 0) {
                this.startGame();
            }
        } else if (event.key && event.key.length === 1) {
            // 일반 문자 입력
            if (this.playerNickname.length < 12) { // 최대 12자
                this.playerNickname += event.key;
                this.updateNicknameDisplay();
            }
        }
    }

    updateNicknameDisplay() {
        if (this.playerNickname.length > 0) {
            this.nicknameText.setText(this.playerNickname);
            this.placeholderText.setVisible(false);
            
            // 커서 위치 업데이트
            const textWidth = this.nicknameText.width;
            this.cursor.x = this.nicknameText.x + textWidth / 2 + 10;
        } else {
            this.nicknameText.setText('');
            this.placeholderText.setVisible(true);
            this.cursor.x = this.scale.width / 2;
        }
        
        this.updateStartButton();
    }

    updateStartButton() {
        if (this.playerNickname.trim().length > 0) {
            this.startButton.setStyle({
                fill: '#fff',
                backgroundColor: '#27ae60'
            });
            
            this.startButton.on('pointerdown', () => {
                this.startGame();
            });
            this.startButton.on('pointerover', () => {
                this.startButton.setStyle({ backgroundColor: '#2ecc71' });
            });
            this.startButton.on('pointerout', () => {
                this.startButton.setStyle({ backgroundColor: '#27ae60' });
            });
        } else {
            this.startButton.setStyle({
                fill: '#95a5a6',
                backgroundColor: '#2c3e50'
            });
            this.startButton.removeAllListeners();
        }
    }

    generateRandomNickname() {
        const adjectives = [
            '용감한', '빠른', '강한', '똑똑한', '귀여운', '신비한', '전설의', '황금의',
            '은빛', '붉은', '푸른', '초록의', '보라색', '핑크색', '검은', '하얀'
        ];
        const nouns = [
            '슬라임', '전사', '마법사', '도적', '궁수', '기사', '닌자', '드래곤',
            '피닉스', '유니콘', '타이거', '울프', '이글', '라이온', '팬더', '토끼'
        ];
        
        const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 99) + 1;
        
        this.playerNickname = `${randomAdj}${randomNoun}${randomNum}`;
        this.updateNicknameDisplay();
    }

    startGame() {
        if (this.playerNickname.trim().length === 0) {
            return;
        }

        // 게임 시작 효과
        this.cameras.main.fadeOut(300, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // 닉네임을 게임 씬으로 전달
            this.scene.start('GameScene', { 
                playerNickname: this.playerNickname.trim()
            });
        });
    }
}