export const JobClasses = {
    slime: {
        name: '슬라임',
        description: '기본 직업. 균형잡힌 스탯을 가지고 있습니다.',
        baseStats: {
            hp: 100,
            attack: 20,
            defense: 10,
            speed: 200,
            visionRange: 200
        },
        skills: [
            {
                name: '점프',
                description: '높이 점프합니다.',
                cooldown: 2000
            }
        ],
        color: 0x00ff00
    },
    
    assassin: {
        name: '어쌔신',
        description: '은신과 기습 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 80,
            attack: 25,
            defense: 5,
            speed: 250,
            visionRange: 300
        },
        skills: [
            {
                name: '은신',
                description: '잠시 투명해져서 추가 데미지를 입힙니다.',
                cooldown: 10000
            }
        ],
        color: 0x800080,
        stealthBonus: 50
    },
    
    ninja: {
        name: '닌자',
        description: '은신과 기습 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 75,
            attack: 28,
            defense: 3,
            speed: 260,
            visionRange: 320
        },
        skills: [
            {
                name: '은신',
                description: '잠시 투명해져서 추가 데미지를 입힙니다.',
                cooldown: 8000
            }
        ],
        color: 0x800080,
        stealthBonus: 60
    },
    
    thief: {
        name: '도적',
        description: '은신과 기습 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 80,
            attack: 25,
            defense: 5,
            speed: 250,
            visionRange: 300
        },
        skills: [
            {
                name: '은신',
                description: '잠시 투명해져서 추가 데미지를 입힙니다.',
                cooldown: 10000
            }
        ],
        color: 0x800080,
        stealthBonus: 50
    },
    
    warrior: {
        name: '전사',
        description: '높은 체력과 근접 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 150,
            attack: 30,
            defense: 20,
            speed: 180,
            visionRange: 180
        },
        skills: [
            {
                name: '돌진',
                description: '앞으로 빠르게 돌진하여 적을 공격합니다.',
                cooldown: 5000
            }
        ],
        color: 0xff0000
    },
    
    mage: {
        name: '마법사',
        description: '원거리 마법과 와드에 특화된 직업입니다.',
        baseStats: {
            hp: 70,
            attack: 35,
            defense: 5,
            speed: 160,
            visionRange: 250
        },
        skills: [
            {
                name: '와드',
                description: '보호막을 생성하여 적의 공격을 막습니다.',
                cooldown: 8000
            }
        ],
        color: 0x0000ff
    },
    
    mechanic: {
        name: '메카닉',
        description: '기계와 기술에 특화된 직업입니다.',
        baseStats: {
            hp: 90,
            attack: 22,
            defense: 8,
            speed: 190,
            visionRange: 220
        },
        skills: [
            {
                name: '기본 스킬',
                description: '기본 메카닉 스킬입니다.',
                cooldown: 5000
            }
        ],
        color: 0xff6600
    }
};

export const JobRequirements = {
    thief: {
        level: 5,
        description: '레벨 5 필요'
    },
    warrior: {
        level: 3,
        description: '레벨 3 필요'
    },
    mage: {
        level: 7,
        description: '레벨 7 필요'
    }
}; 