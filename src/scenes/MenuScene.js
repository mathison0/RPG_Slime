import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        // 게임 UI 숨기기
        const gameUI = document.getElementById('game-ui');
        if (gameUI) {
            gameUI.style.display = 'none';
        }

        const { width, height } = this.scale;
        
        // 타이틀
        this.add.text(width / 2, height / 3, 'RPG SLIME', {
            fontSize: '64px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 서브타이틀
        this.add.text(width / 2, height / 2, '슬라임의 모험', {
            fontSize: '32px',
            fill: '#ccc',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 시작 버튼
        const startButton = this.add.text(width / 2, height * 0.7, '게임 시작', {
            fontSize: '24px',
            fill: '#fff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);

        startButton.setInteractive();
        startButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // 호버 효과
        startButton.on('pointerover', () => {
            startButton.setStyle({ backgroundColor: '#2ecc71' });
        });
        startButton.on('pointerout', () => {
            startButton.setStyle({ backgroundColor: '#27ae60' });
        });

        // 조작법
        this.add.text(width / 2, height * 0.85, 'WASD: 이동 | SPACE: 스킬 | Q: 전직', {
            fontSize: '16px',
            fill: '#999',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
    }
} 