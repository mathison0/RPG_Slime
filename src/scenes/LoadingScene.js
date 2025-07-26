import Phaser from 'phaser';
import AssetLoader from '../utils/AssetLoader.js';

export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
    }

    preload() {
        console.log('LoadingScene preload() 시작');
        
        // 로딩 화면 UI 생성
        this.createLoadingUI();
        
        // 로딩 진행률 이벤트 리스너
        this.load.on('progress', (value) => {
            this.updateLoadingProgress(value);
        });

        this.load.on('complete', () => {
            console.log('모든 에셋 로딩 완료!');
            
            // 애니메이션 생성 (에셋 로딩 후)
            AssetLoader.createAnimations(this);
            
            // 잠시 대기 후 메뉴 화면으로 전환
            this.time.delayedCall(500, () => {
                this.scene.start('MenuScene');
            });
        });

        this.load.on('loaderror', (file) => {
            console.error(`파일 로딩 실패: ${file.src}`);
        });

        // 에셋 로딩 시작
        AssetLoader.preload(this);
    }

    createLoadingUI() {
        const { width, height } = this.scale;
        
        // 배경색
        this.cameras.main.setBackgroundColor('#2c3e50');
        
        // 로딩 텍스트
        this.loadingText = this.add.text(width / 2, height / 2 - 100, 'RPG SLIME', {
            fontSize: '48px',
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.statusText = this.add.text(width / 2, height / 2 - 30, '게임 에셋을 로딩 중...', {
            fontSize: '20px',
            fill: '#ecf0f1',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 로딩 바 배경
        const barWidth = 400;
        const barHeight = 20;
        this.progressBarBg = this.add.rectangle(width / 2, height / 2 + 30, barWidth, barHeight, 0x34495e);
        this.progressBarBg.setStrokeStyle(2, 0x95a5a6);

        // 로딩 바
        this.progressBar = this.add.rectangle(width / 2 - barWidth / 2, height / 2 + 30, 0, barHeight, 0x3498db);
        this.progressBar.setOrigin(0, 0.5);

        // 퍼센트 텍스트
        this.percentText = this.add.text(width / 2, height / 2 + 70, '0%', {
            fontSize: '16px',
            fill: '#bdc3c7',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // 로딩 애니메이션 점들
        this.createLoadingDots();
    }

    createLoadingDots() {
        this.loadingDots = [];
        const dotsY = this.scale.height / 2 + 120;
        
        for (let i = 0; i < 3; i++) {
            const dot = this.add.circle(
                this.scale.width / 2 - 30 + (i * 30), 
                dotsY, 
                5, 
                0x95a5a6
            );
            this.loadingDots.push(dot);
        }

        // 점들이 깜빡이는 애니메이션
        this.tweens.add({
            targets: this.loadingDots,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            stagger: 200
        });
    }

    updateLoadingProgress(value) {
        const barWidth = 400;
        const progress = Math.round(value * 100);
        
        // 프로그레스 바 업데이트
        this.progressBar.width = barWidth * value;
        
        // 퍼센트 텍스트 업데이트
        this.percentText.setText(`${progress}%`);
        
        // 상태 텍스트 업데이트
        if (progress < 30) {
            this.statusText.setText('캐릭터 이미지를 로딩 중...');
        } else if (progress < 60) {
            this.statusText.setText('게임 에셋을 로딩 중...');
        } else if (progress < 90) {
            this.statusText.setText('사운드를 로딩 중...');
        } else {
            this.statusText.setText('로딩 완료!');
        }
        
        // 프로그레스 바 색상 변경
        if (progress >= 100) {
            this.progressBar.setFillStyle(0x27ae60); // 초록색
        } else if (progress >= 70) {
            this.progressBar.setFillStyle(0xf39c12); // 주황색
        }
    }
} 