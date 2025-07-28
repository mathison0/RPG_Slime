/**
 * Server-side standalone JobClasses implementation
 * Contains only the data and functions needed by the server
 */

// Complete JobClasses data for server
const JobClasses = {
    slime: {
        name: '슬라임',
        skills: [
            {
                name: '퍼지기',
                description: '주변 범위에 데미지를 입히는 슬라임 스킬입니다.',
                cooldown: 1000,
                damage: 'attack',
                range: 50,
                key: '1',
                type: 'spread'
            },
        ]
    },
    assassin: {
        name: '어쌔신',
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
        ]
    },
    ninja: {
        name: '닌자',
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
        ]
    },
    warrior: {
        name: '전사',
        skills: [
            {
                name: '돌진',
                description: '앞으로 돌진하며 적을 공격합니다.',
                cooldown: 1500,
                damage: 'attack * 1.5',
                range: 100,
                key: '1',
                type: 'charge'
            }
        ]
    },
    mage: {
        name: '마법사',
        skills: [
            {
                name: '와드',
                description: '주변 적을 탐지하는 와드를 설치합니다.',
                cooldown: 15000,
                damage: 0,
                range: 150,
                duration: 30000,
                key: '1',
                type: 'ward'
            },
            {
                name: '얼음 장판',
                description: '범위에 얼음 장판을 만들어 적을 느리게 합니다.',
                cooldown: 8000,
                damage: 0,
                range: 100,
                duration: 6000,
                key: '2',
                type: 'ice_field'
            },
            {
                name: '마법 투사체',
                description: '마법 투사체를 발사합니다.',
                cooldown: 3000,
                damage: 'attack * 1.2',
                range: 400,
                key: '3',
                type: 'magic_missile'
            }
        ]
    },
    mechanic: {
        name: '메카닉',
        skills: [
            {
                name: '기계 수리',
                description: '자신의 체력을 회복합니다.',
                cooldown: 5000,
                damage: 0,
                heal: 50,
                key: '1',
                type: 'repair'
            }
        ]
    }
};

/**
 * 직업 정보 조회 함수
 */
function getJobInfo(jobClass) {
    return JobClasses[jobClass] || JobClasses.slime;
}

/**
 * 직업별 스킬 정보 조회 (스킬 타입별로 반환)
 */
function getSkillInfo(jobClass, skillType) {
    const jobInfo = getJobInfo(jobClass);
    return jobInfo.skills.find(skill => skill.type === skillType);
}

// Export for server use
module.exports = {
    getSkillInfo
}; 