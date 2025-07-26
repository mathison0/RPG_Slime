// 맵 생성 함수
function generateMap(gameConfig) {
  const {
    MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE, SPAWN_WIDTH_TILES,
    PLAZA_SIZE_TILES
  } = gameConfig;

  const WALL_REMOVAL_CHANCE = 0.25;
  const PLAZA_REMOVAL_CHANCE = 0.01;

  console.log('서버에서 랜덤 맵 생성 중');

  // 타일 기반 계산
  const MAP_WIDTH = MAP_WIDTH_TILES * TILE_SIZE;
  const MAP_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE;
  const SPAWN_WIDTH = SPAWN_WIDTH_TILES * TILE_SIZE;
  const PLAZA_SIZE = PLAZA_SIZE_TILES * TILE_SIZE;
  const PLAZA_X = (MAP_WIDTH - PLAZA_SIZE) / 2;
  const PLAZA_Y = (MAP_HEIGHT - PLAZA_SIZE) / 2;

  const mapData = {
    MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, SPAWN_WIDTH, PLAZA_SIZE, PLAZA_X, PLAZA_Y,
    walls: [],
    redSpawnRect: { x: 0, y: 0, width: SPAWN_WIDTH, height: MAP_HEIGHT },
    blueSpawnRect: { x: MAP_WIDTH - SPAWN_WIDTH + 1, y: 0, width: SPAWN_WIDTH, height: MAP_HEIGHT },
    plazaRect: { x: PLAZA_X, y: PLAZA_Y, width: PLAZA_SIZE, height: PLAZA_SIZE }
  };

  // --- 미로 생성 (타일 기반 그리드) ---
  const gridWidth = MAP_WIDTH_TILES - SPAWN_WIDTH_TILES * 2 + 1;
  const gridHeight = MAP_HEIGHT_TILES;
  const grid = []; // 0: 길, 1: 벽

  // 1. 그리드를 모두 벽(1)으로 초기화
  for (let y = 0; y < gridHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      grid[y][x] = 1;
    }
  }

  const frontiers = [];
  let startX = Math.floor(Math.random() * (gridWidth / 2)) * 2;
  let startY = Math.floor(Math.random() * (gridHeight / 2)) * 2;
  grid[startY][startX] = 0;
  addFrontiers(startX, startY);

  while (frontiers.length > 0) {
    const randomIndex = Math.floor(Math.random() * frontiers.length);
    const frontier = frontiers.splice(randomIndex, 1)[0];
    const { x, y } = frontier;
    const neighbors = getNeighbors(x, y);

    if (neighbors.length === 1) {
      const { nx, ny } = neighbors[0];
      const newPathX = x + (x - nx);
      const newPathY = y + (y - ny);

      if (isValid(newPathX, newPathY) && grid[newPathY][newPathX] === 1) {
        grid[y][x] = 0;
        grid[newPathY][newPathX] = 0;
        addFrontiers(newPathX, newPathY);
      }
    }
  }

  // --- 미로 후처리: 벽 일부를 무작위로 제거하여 길 넓히기, 공터 및 순환로 생성 ---
  for (let y = 1; y < gridHeight - 1; y++) {
    for (let x = 1; x < gridWidth - 1; x++) {
      if (grid[y][x] === 1 && Math.random() < WALL_REMOVAL_CHANCE) {
        grid[y][x] = 0;
      }
    }
  }

  // --- 광장 관련 타일 기반 계산 ---
  const plazaGridX = SPAWN_WIDTH_TILES;
  const plazaGridY = (MAP_HEIGHT_TILES - PLAZA_SIZE_TILES) / 2;
  const plazaGridSize = PLAZA_SIZE_TILES;

  generatePlaza(grid, gridHeight, gridWidth, PLAZA_REMOVAL_CHANCE / 2, 2, plazaGridX, plazaGridY, plazaGridSize);
  generatePlaza(grid, gridHeight, gridWidth, PLAZA_REMOVAL_CHANCE / 5, 3, plazaGridX, plazaGridY, plazaGridSize);
  generatePlaza(grid, gridHeight, gridWidth, PLAZA_REMOVAL_CHANCE / 7, 4, plazaGridX, plazaGridY, plazaGridSize);

  // 광장 좌/우 인접 벽 제거
  for (let y = plazaGridY + 1; y < plazaGridY + plazaGridSize - 1; y++) {
    if (isValid(plazaGridX - 1, y)) grid[y][plazaGridX - 1] = 0;
    if (isValid(plazaGridX + plazaGridSize, y)) grid[y][plazaGridX + plazaGridSize] = 0;
  }
  // 광장 위/아래 인접 벽 제거
  for (let x = plazaGridX + 1; x < plazaGridX + plazaGridSize - 1; x++) {
    if (isValid(x, plazaGridY - 1)) grid[plazaGridY - 1][x] = 0;
    if (isValid(x, plazaGridY + plazaGridSize)) grid[plazaGridY + plazaGridSize][x] = 0;
  }

  // 오른쪽 스폰 구역을 막는 벽에 해당하는 grid 위치를 0으로 설정
  const rightSpawnBoundaryGridX = gridWidth - 1;
  for (let y = 0; y < gridHeight; y++) {
    if (isValid(rightSpawnBoundaryGridX, y)) {
      grid[y][rightSpawnBoundaryGridX] = 0;
    }
  }

  // --- Prim's Algorithm Helper Functions ---
  function addFrontiers(x, y) {
    const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
    for (const dir of directions) {
      const fx = x + dir.dx;
      const fy = y + dir.dy;
      if (isValid(fx, fy) && grid[fy][fx] === 1 && !isFrontier(fx, fy)) {
        frontiers.push({ x: fx, y: fy });
      }
    }
  }
  function getNeighbors(x, y) {
    const neighbors = [];
    const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (isValid(nx, ny) && grid[ny][nx] === 0) {
        neighbors.push({ nx, ny });
      }
    }
    return neighbors;
  }
  function isValid(x, y) {
    return y >= 0 && y < gridHeight && x >= 0 && x < gridWidth;
  }
  function isFrontier(x, y) {
    return frontiers.some(f => f.x === x && f.y === y);
  }

  // 5. 생성된 그리드 데이터를 실제 벽 좌표로 변환 (타일 -> 픽셀)
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (grid[y][x] === 1) {
        const centerX = SPAWN_WIDTH + x * TILE_SIZE + TILE_SIZE / 2;
        const centerY = y * TILE_SIZE + TILE_SIZE / 2;

        if (!isInPlaza(centerX, centerY, PLAZA_X, PLAZA_Y, PLAZA_SIZE)) {
          mapData.walls.push({ x: centerX, y: centerY });
        }
      }
    }
  }

  // 맵의 가장자리 테두리 벽 생성
  for (let x = 0; x < MAP_WIDTH; x += TILE_SIZE) {
    mapData.walls.push({ x: x + TILE_SIZE / 2, y: TILE_SIZE / 2 });
    mapData.walls.push({ x: x + TILE_SIZE / 2, y: MAP_HEIGHT - TILE_SIZE / 2 });
  }
  for (let y = TILE_SIZE; y < MAP_HEIGHT - TILE_SIZE; y += TILE_SIZE) {
    mapData.walls.push({ x: TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
    mapData.walls.push({ x: MAP_WIDTH - TILE_SIZE / 2, y: y + TILE_SIZE / 2 });
  }

  console.log(`맵 생성 완료: 벽 ${mapData.walls.length}개`);
  return mapData;
}


// 광장 내부인지 확인
function isInPlaza(x, y, plazaX, plazaY, plazaSize) {
  return x >= plazaX && x < plazaX + plazaSize &&
         y >= plazaY && y < plazaY + plazaSize;
}

// 벽 위치인지 확인
function isWallPosition(x, y, mapData) {
  if (!mapData) return false;

  const TILE_SIZE = mapData.TILE_SIZE;
  return mapData.walls.some(wall => {
    const dx = Math.abs(wall.x - x);
    const dy = Math.abs(wall.y - y);
    return dx < TILE_SIZE / 2 && dy < TILE_SIZE / 2;
  });
}

function generatePlaza(grid, gridHeight, gridWidth, PLAZA_REMOVAL_CHANCE, PLAZA_SIZE, plazaGridX, plazaGridY, plazaGridSize) {
  for (let y = PLAZA_SIZE; y < gridHeight - PLAZA_SIZE; y++) {
    for (let x = PLAZA_SIZE * 2; x < gridWidth - PLAZA_SIZE * 2; x++) {
      // 만약 광장에서 PLAZA_SIZE만큼 떨어진 범위라면 continue
      if (x > plazaGridX - PLAZA_SIZE * 2 && x < plazaGridX + plazaGridSize + PLAZA_SIZE * 2 && y > plazaGridY - PLAZA_SIZE * 2 && y < plazaGridY + plazaGridSize + PLAZA_SIZE * 2) {
        continue;
      }

      if (Math.random() < PLAZA_REMOVAL_CHANCE) {
        for (let i = -PLAZA_SIZE; i < PLAZA_SIZE + 1; i++) {
          for (let j = -PLAZA_SIZE; j < PLAZA_SIZE + 1; j++) {
            const newY = y + i;
            const newX = x + j;
            // 배열 경계 체크 추가
            if (newY >= 0 && newY < gridHeight && newX >= 0 && newX < gridWidth) {
              grid[newY][newX] = 0;
            }
          }
        }
      }
    }
  }
}

// 모듈 export
module.exports = {
  generateMap,
  isWallPosition,
  isInPlaza
};