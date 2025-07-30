/**
 * 직업 클래스 정의 (서버용)
 * shared/JobClasses.js에서 복사한 내용을 사용합니다.
 */

// ============================================================
// 📋 업데이트 방법
// ============================================================
// 1. shared/JobClasses.js에서 "복사 시작" ~ "복사 끝" 사이의 내용을 복사
// 2. 아래 기존 내용을 삭제하고 붙여넣기
// 3. 파일 맨 아래 module.exports는 그대로 유지
// ============================================================

// 🔽 여기서부터 shared/JobClasses.js에서 복사한 내용을 붙여넣으세요 🔽

const JobClasses = {
    slime: {
        name: '슬라임',
        description: '기본 직업. 균형잡힌 스탯과 범위 공격 스킬을 가지고 있습니다.',
        baseStats: {
            hp: 100,
            attack: 5,
            speed: 200,
            visionRange: 300
        },
        levelGrowth: {
            hp: 20,
            attack: 1,
            speed: 0
        },
        skills: [
            {
                name: '퍼지기',
                description: '주변 범위에 데미지를 입히는 슬라임 스킬입니다.',
                cooldown: 1000,
                damage: 'attack',
                range: 150,
                duration: 400,
                key: '1',
                type: 'spread'
            },
        ],
        basicAttackCooldown: 600,
        color: 0x00ff00,
        maxLevel: 50
    },

    assassin: {
        name: '어쌔신',
        description: '은신과 기습 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 80,
            attack: 25,
            speed: 250,
            visionRange: 320
        },
        levelGrowth: {
            hp: 15,
            attack: 7,
            speed: 0
        },
        skills: [
            {
                name: '은신',
                description: '3초간 투명해져서 다음 공격에 추가 데미지를 입힙니다.',
                cooldown: 10000,
                damage: 50,
                duration: 3000,
                key: '1',
                type: 'stealth'
            }
        ],
        basicAttackCooldown: 300,
        color: 0x000000,
        maxLevel: 50
    },

    ninja: {
        name: '닌자',
        description: '빠른 은신과 치명적인 기습에 특화된 직업입니다.',
        baseStats: {
            hp: 75,
            attack: 28,
            speed: 260,
            visionRange: 340
        },
        levelGrowth: {
            hp: 12,
            attack: 8,
            speed: 0
        },
        skills: [
            {
                name: '그림자 은신',
                description: '3초간 투명해져서 다음 공격에 더 큰 추가 데미지를 입힙니다.',
                cooldown: 8000,
                damage: 60,
                duration: 3000,
                key: '1',
                type: 'stealth'
            }
        ],
        basicAttackCooldown: 500,
        color: 0x000000,
        maxLevel: 50
    },

    warrior: {
        name: '전사',
        description: '높은 체력과 방어력을 가진 근접 전투 전문가입니다.',
        baseStats: {
            hp: 150,
            attack: 30,
            speed: 180,
            visionRange: 250
        },
        levelGrowth: {
            hp: 30,
            attack: 6,
            speed: 0
        },
        skills: [
            {
                name: '울부짖기',
                description: '강력한 울부짖기로 주변 적들을 위협합니다.',
                cooldown: 1000,
                damage: 0,
                range: 50,
                duration: 400,
                key: 'Q',
                type: 'roar'
            },
            {
                name: '휩쓸기',
                description: '부채꼴 범위 공격으로 적을 기절시킵니다.',
                cooldown: 3000,
                damage: 'attack',
                range: 100,
                angleOffset: Math.PI / 4, 
                delay: 1000,
                afterDelay: 300,
                stunDuration: 2500,
                key: 'E',
                type: 'sweep'
            },
            {
                name: '찌르기',
                description: '직사각형 범위 공격으로 강력한 데미지를 입힙니다.',
                cooldown: 4000,
                damage: 'attack * 3',
                range: 200,
                width: 50,
                delay: 1500,
                afterDelay: 800,
                stunDuration: 1000,
                key: 'R',
                type: 'thrust'
            }
        ],
        basicAttackCooldown: 800,
        color: 0xff0000,
        maxLevel: 50
    },

    mage: {
        name: '마법사',
        description: '다양한 마법 스킬과 원거리 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 70,
            attack: 35,
            speed: 160,
            visionRange: 400
        },
        levelGrowth: {
            hp: 10,
            attack: 8,
            speed: 0
        },
        skills: [
            {
                name: '얼음 장판',
                description: '범위 내 적들의 속도를 감소시킵니다.',
                cooldown: 12000,
                damage: 0,
                range: 100,  // 얼음 장판의 효과 범위 (반지름)
                maxCastRange: 300, // 최대 시전 사거리
                duration: 6000,
                effect: 'slow',
                key: '1',
                type: 'ice_field'
            },
            {
                name: '마법 투사체',
                description: '마우스 방향으로 마법 투사체를 발사합니다.',
                cooldown: 3000,
                damage: 'attack * 5.0',
                range: 400,
                explosionRadius: 90, // 폭발 범위
                afterDelay: 200,
                key: '2',
                type: 'magic_missile'
            },
            {
                name: '보호막',
                description: '일정 시간 동안 보호막을 생성합니다.',
                cooldown: 15000,
                damage: 0,
                duration: 4000,
                effect: 'shield',
                knockbackDistance: 40, // 밀어내기 거리
                key: '3',
                type: 'shield'
            }
        ],
        basicAttackCooldown: 700,
        color: 0x0000ff,
        maxLevel: 50
    },

    mechanic: {
        name: '메카닉',
        description: '기계와 기술을 활용하는 다재다능한 직업입니다.',
        baseStats: {
            hp: 90,
            attack: 22,
            speed: 190,
            visionRange: 280
        },
        levelGrowth: {
            hp: 18,
            attack: 6,
            speed: 0
        },
        skills: [
            {
                name: '기계 수리',
                description: '자신의 체력을 회복합니다.',
                cooldown: 5000,
                damage: 0,
                heal: 50,
                afterDelay: 600, // 수리 후 짧은 후딜레이
                key: '1',
                type: 'repair'
            }
        ],
        basicAttackCooldown: 600,
        color: 0x556B2F,
        maxLevel: 50
    },

    archer: {
        name: '궁수',
        description: '원거리 공격에 특화된 직업입니다.',
        baseStats: {
            hp: 85,
            attack: 30,
            speed: 200,
            visionRange: 350
        },
        levelGrowth: {
            hp: 15,
            attack: 8,
            speed: 0
        },
        skills: [
            {
                name: '구르기',
                description: '빠르게 구르며 이동합니다.',
                cooldown: 2000,
                damage: 0,
                range: 150,
                afterDelay: 200,
                key: '1',
                type: 'roll'
            },
            {
                name: '궁사의 집중',
                description: '일정 시간 동안 공격 속도를 증가시킵니다.',
                cooldown: 8000,
                damage: 0,
                duration: 5000,
                effect: 'attack_speed_boost',
                key: '2',
                type: 'focus'
            }
        ],
        basicAttackCooldown: 700,
        color: 0xFF8C00,
        maxLevel: 50
    },

    supporter: {
        name: '힐러',
        description: '팀원을 지원하고 치유하는 서포터 직업입니다.',
        baseStats: {
            hp: 90,
            attack: 15,
            speed: 180,
            visionRange: 320
        },
        levelGrowth: {
            hp: 20,
            attack: 3,
            speed: 0
        },
        skills: [
            {
                name: '와드 설치',
                description: '일정 범위에 시야를 제공하고 상태이상을 감지합니다.',
                cooldown: 10000,
                damage: 0,
                range: 150,
                castRange: 300, // 와드 설치 사정거리
                duration: 200000,
                afterDelay: 0,
                key: '1',
                type: 'ward'
            },
            {
                name: '버프 장판',
                description: '이동속도와 공격속도를 증가시키는 장판을 설치합니다.',
                cooldown: 6000,
                damage: 0,
                range: 80,
                duration: 4000,
                effect: 'speed_attack_boost',
                key: '2',
                type: 'buff_field'
            },
            {
                name: '힐 장판',
                description: '범위 내 아군의 체력을 지속적으로 회복시킵니다.',
                cooldown: 15000,
                damage: 0,
                range: 100,
                duration: 8000,
                heal: 20,
                key: '3',
                type: 'heal_field'
            }
        ],
        basicAttackCooldown: 900,
        color: 0xFFFF00,
        maxLevel: 50
    }
};

const JobRequirements = {
    slime: {
        level: 1,
        description: '기본 직업'
    },
    assassin: {
        level: 5,
        description: '레벨 5 필요'
    },
    ninja: {
        level: 8,
        description: '레벨 8 필요'
    },
    warrior: {
        level: 3,
        description: '레벨 3 필요'
    },
    mage: {
        level: 7,
        description: '레벨 7 필요'
    },
    mechanic: {
        level: 10,
        description: '레벨 10 필요'
    },
    archer: {
        level: 6,
        description: '레벨 6 필요'
    },
    supporter: {
        level: 4,
        description: '레벨 4 필요'
    }
};

/**
 * 직업 정보 조회 함수
 */
function getJobInfo(jobClass) {
    return JobClasses[jobClass] || JobClasses.slime;
}

/**
 * 직업 변경 가능 여부 확인
 */
function canChangeJob(currentLevel, targetJob) {
    const requirement = JobRequirements[targetJob];
    return currentLevel >= requirement.level;
}

/**
 * 레벨에 따른 스탯 계산
 */
function calculateStats(jobClass, level) {
    const jobInfo = getJobInfo(jobClass);
    const stats = { ...jobInfo.baseStats };
    
    const levelDiff = level - 1;
    stats.hp += jobInfo.levelGrowth.hp * levelDiff;
    stats.attack += jobInfo.levelGrowth.attack * levelDiff;
    stats.speed += jobInfo.levelGrowth.speed * levelDiff;
    
    return stats;
}

/**
 * 직업별 스킬 정보 조회 (스킬 타입별로 반환)
 */
function getSkillInfo(jobClass, skillType) {
    const jobInfo = getJobInfo(jobClass);
    return jobInfo.skills.find(skill => skill.type === skillType);
}

/**
 * 모든 직업의 스킬을 타입별로 매핑한 객체 생성
 */
function createSkillTypeMap() {
    const skillMap = {};
    
    Object.values(JobClasses).forEach(jobInfo => {
        jobInfo.skills.forEach(skill => {
            if (!skillMap[skill.type]) {
                skillMap[skill.type] = {};
            }
            skillMap[skill.type] = {
                cooldown: skill.cooldown,
                damage: skill.damage,
                range: skill.range || 0,
                duration: skill.duration || 0,
                heal: skill.heal || 0,
                effect: skill.effect
            };
        });
    });
    
    return skillMap;
}

// 🔼 여기까지 shared/JobClasses.js에서 복사한 내용입니다 🔼

// ============================================================
// ⚠️  아래 module.exports는 절대 삭제하지 마세요! ⚠️
// ============================================================

module.exports = {
    JobClasses,
    JobRequirements,
    getJobInfo,
    canChangeJob,
    calculateStats,
    getSkillInfo,
    createSkillTypeMap
}; 