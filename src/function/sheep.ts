window.addEventListener("load", () => {
    const boundaryPath = document.querySelector<SVGPathElement>("#sheep-boundary-path");
    if (!boundaryPath) return;
  
    const SHEEP_RADIUS = 25;
  
    // --- Boundary ---
  
    function getPointsFromPath(
      pathElement: SVGPathElement,
      samples = 200
    ): [number, number][] {
      const totalLength = pathElement.getTotalLength();
      const points: [number, number][] = [];
      const ctm = pathElement.getScreenCTM();
      if (!ctm) return [];
  
      for (let i = 0; i <= samples; i++) {
        const svgPoint = pathElement.getPointAtLength((i / samples) * totalLength);
        const screenPoint = svgPoint.matrixTransform(ctm);
        points.push([screenPoint.x, screenPoint.y]);
      }
  
      return points;
    }
  
    let BOUNDARY: [number, number][] = getPointsFromPath(boundaryPath);
  
    let prevMinX = Math.min(...BOUNDARY.map(([x]) => x));
    let prevMinY = Math.min(...BOUNDARY.map(([, y]) => y));
    let prevMaxX = Math.max(...BOUNDARY.map(([x]) => x));
    let prevMaxY = Math.max(...BOUNDARY.map(([, y]) => y));
  
    function isInsideBoundary(x: number, y: number): boolean {
      let inside = false;
      const n = BOUNDARY.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = BOUNDARY[i];
        const [xj, yj] = BOUNDARY[j];
        const intersects =
          yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
      return inside;
    }
  
    function clampToBoundary(x: number, y: number): [number, number] {
      let closest: [number, number] = BOUNDARY[0];
      let minDist = Infinity;
      const n = BOUNDARY.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [ax, ay] = BOUNDARY[j];
        const [bx, by] = BOUNDARY[i];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let t = ((x - ax) * dx + (y - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx;
        const cy = ay + t * dy;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closest = [cx, cy];
        }
      }
      return closest;
    }
  
    function randomPointInBoundary(): [number, number] {
      const xs = BOUNDARY.map(([x]) => x);
      const ys = BOUNDARY.map(([, y]) => y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      let x: number, y: number;
      do {
        x = minX + Math.random() * (maxX - minX);
        y = minY + Math.random() * (maxY - minY);
      } while (!isInsideBoundary(x, y));
      return [x, y];
    }
  
    // --- Sheep factory ---
  
    const sheepInstances: ReturnType<typeof createSheep>[] = [];
  
    function createSheep(element: HTMLImageElement, spawnMoving = false) {
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let lastTimestamp: number | null = null;
      let animationFrameId: number | null = null;
      let isMoving = false;
      let isEating = false;
  
      const SPEED = 64;
      const ARRIVAL_THRESHOLD = 1;
      const GIF_SRC = element.src;
      const STILL_SRC = element.dataset.stillSrc ?? GIF_SRC;
      const EAT_SRC = element.dataset.eatSrc ?? GIF_SRC;
  
      element.src = STILL_SRC;
      element.style.position = "absolute";
  
      function setMoving(moving: boolean) {
        if (moving === isMoving) return;
        isMoving = moving;
        if (moving) {
          isEating = false;
          element.src = GIF_SRC;
        } else {
          element.src = STILL_SRC;
        }
      }
  
      function setDirection(newTargetX: number) {
        const dx = newTargetX - currentX;
        if (dx > 0) element.style.transform = "scaleX(1)";
        else if (dx < 0) element.style.transform = "scaleX(-1)";
      }
  
      function tick(timestamp: number) {
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const delta = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
  
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
  
        if (distance > ARRIVAL_THRESHOLD) {
          const step = SPEED * delta;
          let nextX: number;
          let nextY: number;
  
          if (step >= distance) {
            nextX = targetX;
            nextY = targetY;
          } else {
            nextX = currentX + (dx / distance) * step;
            nextY = currentY + (dy / distance) * step;
          }
  
          const blocked = sheepInstances.some((other) => {
            if (other.currentX === currentX && other.currentY === currentY) return false;
            const ox = nextX - other.currentX;
            const oy = nextY - other.currentY;
            return Math.sqrt(ox * ox + oy * oy) < SHEEP_RADIUS * 2;
          });
  
          if (blocked) {
            // Keep ticking so sheep resumes when path clears
            animationFrameId = requestAnimationFrame(tick);
          } else {
            currentX = nextX;
            currentY = nextY;
            element.style.left = `${currentX}px`;
            element.style.top = `${currentY}px`;
            setMoving(true);
            animationFrameId = requestAnimationFrame(tick);
          }
        } else {
          currentX = targetX;
          currentY = targetY;
          element.style.left = `${currentX}px`;
          element.style.top = `${currentY}px`;
          setMoving(false);
          animationFrameId = null;
          lastTimestamp = null;
        }
      }
  
      function startMovingTo(x: number, y: number) {
        targetX = x;
        targetY = y;
        setDirection(targetX);
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(tick);
        }
      }
  
      function maybeEat() {
        if (isMoving || isEating) return;
        if (Math.random() > 0.2) return;
        isEating = true;
        element.src = EAT_SRC;
        setTimeout(() => {
          if (!isMoving) element.src = STILL_SRC;
          isEating = false;
        }, 2000);
      }
  
      function maybeWander() {
        if (isMoving || isEating) return;
        if (Math.random() > 0.3) return;
        const [x, y] = randomPointInBoundary();
        startMovingTo(x, y);
      }
  
      setInterval(maybeEat, 3000);
      setInterval(maybeWander, 4000);
  
      const [startX, startY] = randomPointInBoundary();
      currentX = startX;
      currentY = startY;
      element.style.left = `${currentX}px`;
      element.style.top = `${currentY}px`;
  
      if (spawnMoving) {
        const [x, y] = randomPointInBoundary();
        startMovingTo(x, y);
      }
  
      return {
        get currentX() { return currentX; },
        get currentY() { return currentY; },
        move(x: number, y: number) { startMovingTo(x, y); },
        teleport(x: number, y: number) {
          currentX = x;
          currentY = y;
          targetX = x;
          targetY = y;
          element.style.left = `${currentX}px`;
          element.style.top = `${currentY}px`;
        },
      };
    }
  
    // --- Init all sheep ---
  
    document.querySelectorAll<HTMLImageElement>(".sheep-image").forEach((el) => {
      sheepInstances.push(createSheep(el, Math.random() > 0.5));
    });
  
    // --- Resize handler ---
  
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  
    window.addEventListener("resize", () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newBoundary = getPointsFromPath(boundaryPath);
        if (newBoundary.length === 0) return;
  
        const newMinX = Math.min(...newBoundary.map(([x]) => x));
        const newMinY = Math.min(...newBoundary.map(([, y]) => y));
        const newMaxX = Math.max(...newBoundary.map(([x]) => x));
        const newMaxY = Math.max(...newBoundary.map(([, y]) => y));
  
        sheepInstances.forEach((sheep) => {
          const tx = (sheep.currentX - prevMinX) / (prevMaxX - prevMinX);
          const ty = (sheep.currentY - prevMinY) / (prevMaxY - prevMinY);
          const newX = newMinX + tx * (newMaxX - newMinX);
          const newY = newMinY + ty * (newMaxY - newMinY);
          sheep.teleport(newX, newY);
        });
  
        BOUNDARY = newBoundary;
        prevMinX = newMinX;
        prevMinY = newMinY;
        prevMaxX = newMaxX;
        prevMaxY = newMaxY;
      }, 100);
    });
  
    // --- Click handler ---
  
    document.addEventListener("click", (e) => {
      let x = e.clientX;
      let y = e.clientY;
  
      if (!isInsideBoundary(x, y)) {
        [x, y] = clampToBoundary(x, y);
      }
  
      let closestSheep = sheepInstances[0];
      let closestDist = Infinity;
  
      sheepInstances.forEach((sheep) => {
        const dist = Math.sqrt(
          (sheep.currentX - x) ** 2 + (sheep.currentY - y) ** 2
        );
        if (dist < closestDist) {
          closestDist = dist;
          closestSheep = sheep;
        }
      });
  
      closestSheep.move(x, y);
    });
  });