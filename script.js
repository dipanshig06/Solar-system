
window.onload = () => {

  // === Setup basic scene, camera, renderer ===
  const canvas = document.getElementById("solarCanvas");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

    // Handle window resizing responsively
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
  });


  // === Add lighting ===
  const light = new THREE.PointLight(0xffffff, 1.5, 0);
  light.position.set(0, 0, 0);
  scene.add(light);
  const ambient = new THREE.AmbientLight(0x333333);
  scene.add(ambient);

  const textureLoader = new THREE.TextureLoader();

  // === Planet data and properties ===
  const planetData = [
    { name: "Sun", radius: 4, texture: "sun.jpg", distance: 0, speed: 0, eccentricity: 0 },
    { name: "Mercury", radius: 0.3, texture: "mercury.jpg", distance: 6, speed: 0.047, eccentricity: 0.206 },
    { name: "Venus", radius: 0.6, texture: "venus.jpg", distance: 8, speed: 0.018, eccentricity: 0.007 },
    { name: "Earth", radius: 0.65, texture: "earth.jpg", distance: 10, speed: 0.011, eccentricity: 0.017 },
    { name: "Mars", radius: 0.5, texture: "mars.jpg", distance: 12, speed: 0.006, eccentricity: 0.093 },
    { name: "Jupiter", radius: 1.5, texture: "jupiter.jpg", distance: 16, speed: 0.001, eccentricity: 0.049 },
    { name: "Saturn", radius: 1.3, texture: "saturn.jpg", distance: 20, speed: 0.0004, eccentricity: 0.057 },
    { name: "Uranus", radius: 1.0, texture: "uranus.jpg", distance: 24, speed: 0.0001, eccentricity: 0.046 },
    { name: "Neptune", radius: 1.0, texture: "neptune.jpg", distance: 28, speed: 0.00005, eccentricity: 0.010 }
  ];

  const planets = {};
  const planetAngles = {};
  const planetSpeeds = {};
  const orbits = [];
  const orbitLines = [];

   // === Tooltip setup ===
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "4px 8px";
  tooltip.style.background = "#222";
  tooltip.style.color = "white";
  tooltip.style.borderRadius = "4px";
  tooltip.style.pointerEvents = "none";
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // === Track mouse position for hover detection ===
  window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  // === Create star background ===
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 500;
  const starVertices = [];
  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const y = (Math.random() - 0.5) * 1000;
    const z = (Math.random() - 0.5) * 1000;
    starVertices.push(x, y, z);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // === Generate planets, textures, orbits, and controls ===
  planetData.forEach(data => {
    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    const texture = textureLoader.load(`textures/${data.texture}`);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    mesh.userData = { name: data.name };
    if (data.name === "Sun") {
      mesh.position.set(0, 0, 0);
    }

    planets[data.name] = mesh;
    planetAngles[data.name] = Math.random() * Math.PI * 2;
    planetSpeeds[data.name] = data.speed;

    // Add sliders for speed control
    const label = document.createElement("label");
    label.innerHTML = `${data.name}: <input type='range' min='0' max='0.1' step='0.001' value='${data.speed}' id='${data.name}-slider'>`;
    document.getElementById("controls").appendChild(label);

    const slider = document.getElementById(`${data.name}-slider`);
    slider.addEventListener("input", e => {
      planetSpeeds[data.name] = parseFloat(e.target.value);
    });

    // Draw elliptical orbit path
    if (data.distance > 0) {
      const ellipse = new THREE.EllipseCurve(
        0, 0,
        data.distance * (1 + data.eccentricity),
        data.distance * (1 - data.eccentricity),
        0, 2 * Math.PI,
        false,
        0
      );
      const points = ellipse.getPoints(100).map(p => new THREE.Vector3(p.x, 0, p.y));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff });
      const orbit = new THREE.Line(geometry, material);
      orbit.visible = false;
      scene.add(orbit);
      orbits.push(orbit);
    }

    // Add Saturn ring
    if (data.name === "Saturn") {
      const ringGeometry = new THREE.RingGeometry(data.radius + 0.3, data.radius + 0.7, 64);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      mesh.add(ring);
    }
  });

  let isPaused = false;
  const clock = new THREE.Clock();

  // === Pause/Resume animation ===
  document.getElementById("toggleAnimation").addEventListener("click", () => {
    isPaused = !isPaused;
    document.getElementById("toggleAnimation").textContent = isPaused ? "Resume" : "Pause";
  });

  // === Focus camera on selected planet ===
  document.getElementById("focusSelect").addEventListener("change", e => {
    const selected = e.target.value;
    if (planets[selected]) {
      camera.position.set(
        planets[selected].position.x + 5,
        planets[selected].position.y + 5,
        planets[selected].position.z + 5
      );
      camera.lookAt(planets[selected].position);
    }
  });

  // === Zoom to planet on click ===
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(planets));
    if (intersects.length > 0) {
      const planet = intersects[0].object;
      const pos = planet.position;
      gsap.to(camera.position, {
        duration: 1.5,
        x: pos.x + 5,
        y: pos.y + 5,
        z: pos.z + 5,
        onUpdate: () => {
          camera.lookAt(pos);
        }
      });
    }
  });

  // === Orbit path toggle button ===
  const pathToggle = document.createElement("button");
  pathToggle.textContent = "Show Orbit Paths";
  pathToggle.style.marginTop = "10px";
  pathToggle.onclick = () => {
    const show = pathToggle.textContent === "Show Orbit Paths";
    orbits.forEach(orbit => orbit.visible = show);
    pathToggle.textContent = show ? "Hide Orbit Paths" : "Show Orbit Paths";
  };
  document.getElementById("ui-panel").appendChild(pathToggle);

  // === Light/Dark theme toggle ===
  const themeToggle = document.createElement("button");
  themeToggle.textContent = "Light Mode";
  themeToggle.style.marginTop = "10px";
  themeToggle.onclick = () => {
    const isDark = scene.background === null;
    if (isDark) {
      scene.background = new THREE.Color(0x87CEEB); // sky blue
      tooltip.style.background = "#eee";
      tooltip.style.color = "#000";
      orbits.forEach(o => o.material.color.set(0x000000)); // orbit color black
      document.body.style.color = "#000";
    } else {
      scene.background = null;
      tooltip.style.background = "#222";
      tooltip.style.color = "#fff";
      orbits.forEach(o => o.material.color.set(0xffffff)); // orbit color white
      document.body.style.color = "#ededed";
    }
    themeToggle.textContent = isDark ? "Dark Mode" : "Light Mode";
  };
  document.getElementById("ui-panel").appendChild(themeToggle);

   // === Reset camera to default view ===
  const resetView = document.createElement("button");
  resetView.textContent = "Reset View";
  resetView.style.marginTop = "10px";
  resetView.onclick = () => {
    gsap.to(camera.position, {
      duration: 1.5,
      x: 0,
      y: 0,
      z: 50,
      onUpdate: () => {
        camera.lookAt(new THREE.Vector3(0, 0, 0));
      }
    });
  };
  document.getElementById("ui-panel").appendChild(resetView);

  camera.position.z = 50;

  // === Animation loop ===
  function animate(event) {
    requestAnimationFrame(animate);
    if (!isPaused) {
      const delta = clock.getDelta();

      planetData.forEach(({ name, distance, eccentricity }) => {
        if (name !== "Sun") {
          planetAngles[name] += planetSpeeds[name] * delta * 10;
          const a = distance * (1 + eccentricity);
          const b = distance * (1 - eccentricity);
          planets[name].position.x = a * Math.cos(planetAngles[name]);
          planets[name].position.z = b * Math.sin(planetAngles[name]);
          planets[name].rotation.y += 0.01;
        }
      });
    }

    // Hover tooltip rendering
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(planets));
    if (intersects.length > 0) {
      tooltip.style.display = "block";
      tooltip.innerText = intersects[0].object.userData.name;
      tooltip.style.left = event.clientX + 10 + "px";
      tooltip.style.top = event.clientY + 10 + "px";
    } else {
      tooltip.style.display = "none";
    }

    renderer.render(scene, camera);
  }

  animate();
};
