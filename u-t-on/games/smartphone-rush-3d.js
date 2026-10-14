/* Small, dependency-free WebGL renderer. Gameplay stays in the 2D ground plane. */
(function (root) {
    'use strict';
    function multiply(a, b) {
        const out = new Float32Array(16);
        for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
            for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
        }
        return out;
    }
    function perspective(fov, aspect, near, far) {
        const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
        return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    }
    function lookAt(eye, target) {
        const normalize = v => { const length = Math.hypot(...v); return v.map(n => n / length); };
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const z = normalize(eye.map((n, i) => n - target[i]));
        const x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
        const dot = v => -v.reduce((sum, n, i) => sum + n * eye[i], 0);
        return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, dot(x), dot(y), dot(z), 1]);
    }
    function project(matrix, x, y, z, width, height) {
        const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
        if (w <= 0) return null;
        const px = (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w;
        const py = (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w;
        return { x: (px + 1) * width / 2, y: (1 - py) * height / 2 };
    }
    const faces = [
        [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
        [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
        [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
        [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
        [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
        [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]
    ];
    const colorCache = new Map();
    function color(hex) {
        if (!colorCache.has(hex)) {
            const n = parseInt(hex.slice(1, 7), 16);
            colorCache.set(hex, [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
        }
        return colorCache.get(hex);
    }
    function createRenderer(canvas) {
        const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' });
        if (!gl) return null;
        const vertexSource = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
            uniform mat4 uMatrix; varying vec3 vColor;
            void main() {
                float light = 0.52 + 0.48 * max(dot(normalize(aNormal), normalize(vec3(-0.35,0.9,0.45))), 0.0);
                vColor = aColor * light; gl_Position = uMatrix * vec4(aPosition,1.0);
            }`;
        const fragmentSource = `precision mediump float; varying vec3 vColor;
            void main() { gl_FragColor = vec4(vColor,1.0); }`;
        function compile(type, source) {
            const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error); }
            return shader;
        }
        const vs = compile(gl.VERTEX_SHADER, vertexSource), fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
        gl.deleteShader(vs); gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        const buffer = gl.createBuffer(), matrixUniform = gl.getUniformLocation(program, 'uMatrix');
        gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        for (const [name, offset] of [['aPosition', 0], ['aNormal', 12], ['aColor', 24]]) {
            const attribute = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 36, offset);
        }
        gl.enable(gl.DEPTH_TEST); gl.clearColor(.075, .13, .17, 1);
        let vertices = new Float32Array(360000);
        let used = 0, viewProjection, logicalWidth = 560, logicalHeight = 620;
        function vertex(position, normal, rgb) {
            if (used + 9 > vertices.length) {
                const larger = new Float32Array(vertices.length * 2); larger.set(vertices); vertices = larger;
            }
            vertices.set(position, used); vertices.set(normal, used + 3); vertices.set(rgb, used + 6); used += 9;
        }
        function rotate(v, yaw, tilt) {
            const ct = Math.cos(tilt), st = Math.sin(tilt), c = Math.cos(yaw), s = Math.sin(yaw);
            const y = v[1] * ct - v[2] * st, z = v[1] * st + v[2] * ct;
            return [v[0] * c + z * s, y, -v[0] * s + z * c];
        }
        function box(x, y, z, sx, sy, sz, hex, yaw = 0, tilt = 0) {
            const rgb = color(hex);
            for (const face of faces) {
                const normal = rotate(face[0], yaw, tilt);
                for (const i of [1, 2, 3, 1, 3, 4]) {
                    const p = rotate([face[i][0] * sx / 2, face[i][1] * sy / 2, face[i][2] * sz / 2], yaw, tilt);
                    vertex([p[0] + x, p[1] + y, p[2] + z], normal, rgb);
                }
            }
        }
        function disc(x, z, radius, hex, ring = false) {
            const rgb = color(hex), y = ring ? .7 : .5;
            for (let i = 0; i < 24; i++) {
                const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
                const point = (r, angle) => [x + Math.cos(angle) * r, y, z + Math.sin(angle) * r];
                if (ring) {
                    for (const p of [point(radius, a), point(radius, b), point(radius - 2, b), point(radius, a), point(radius - 2, b), point(radius - 2, a)]) vertex(p, [0, 1, 0], rgb);
                } else for (const p of [[x, y, z], point(radius, a), point(radius, b)]) vertex(p, [0, 1, 0], rgb);
            }
        }
        function station(state) {
            const w = state.width, h = state.height;
            box(0, -9, 0, w + 28, 18, h + 22, '#253f49');
            for (let x = -w / 2; x < w / 2; x += 56) for (let z = -h / 2; z < h / 2; z += 56) {
                const even = (Math.round((x + w / 2) / 56) + Math.round((z + h / 2) / 56)) % 2;
                box(x + 27, .05, z + 27, 54, .1, Math.min(54, h / 2 - z), even ? '#3c545d' : '#415b64');
            }
            for (const x of [-w / 2 + 20, w / 2 - 20]) {
                box(x, .1, 10, 8, 1, h - 30, '#c9b66d');
                for (let z = -h / 2 + 30; z < h / 2; z += 18) box(x, .8, z, 5, 1, 3, '#ecdc91');
            }
            // Back wall and ticket gates leave the active play area unobstructed.
            box(0, 22, -h / 2 - 3, w + 20, 44, 12, '#263e48');
            for (let i = 0; i < 5; i++) {
                const x = -136 + i * 68;
                box(x, 17, -h / 2 + 32, 23, 34, 36, '#7f969a');
                box(x, 35, -h / 2 + 28, 20, 3, 26, '#9dc7c4');
                box(x, 36, -h / 2 + 21, 8, 2, 8, '#65e2c3');
            }
            box(0, 68, -h / 2 + 4, 220, 24, 9, '#102936');
            box(0, 69, -h / 2 + 10, 176, 3, 1, '#88c9ba');
            for (const pillar of state.pillars) {
                const x = pillar.x - w / 2, z = pillar.y - h / 2;
                box(x, 31, z, 35, 62, 35, '#687f88'); box(x, 64, z, 40, 5, 40, '#9cacae');
                box(x, 30, z + 18, 25, 23, 1, '#223e4a'); box(x, 35, z + 19, 14, 3, 1, '#d2d9c0');
            }
            for (const x of [-165, 165]) for (const z of [-180, 70, 240]) {
                box(x, .2, z, 5, 1, 22, '#7b999f');
                box(x - 4, .3, z - 8, 5, 1, 12, '#7b999f', -.55); box(x + 4, .3, z - 8, 5, 1, 12, '#7b999f', .55);
            }
        }
        function person(npc, state, player = false) {
            const x = npc.x - state.width / 2, z = npc.y - state.height / 2;
            const flight = npc.flightTime > 0;
            const rainbow = ['#ff6688', '#ffb957', '#ffee66', '#69ef99', '#69dfff', '#a68aff'];
            const glow = rainbow[Math.floor(state.elapsed * 8 + npc.id) % rainbow.length];
            if (npc.rampage) { disc(x, z, 25, glow, true); disc(x, z, 30, glow, true); }
            const yaw = (npc.spinAngle || 0) + (player ? Math.atan2(-npc.dx, -npc.dy) : flight ? Math.atan2(-npc.vx, -npc.vy) : (npc.direction === 1 ? Math.PI : 0));
            const tilt = flight ? .85 : npc.fall > 0 ? 1.4 : 0, base = (npc.hop > 0 ? Math.sin(npc.hop / .38 * Math.PI) * 19 : 0) + (flight ? 12 + Math.sin(state.elapsed * 12) * 3 : npc.fall > 0 ? 9 : 0);
            disc(x + 3, z + 4, player ? 18 : 16, '#2a4149');
            if (player) disc(x, z, 25, '#ffc265', true);
            if (flight) {
                disc(x, z, 20, '#7ee4d5', true);
                const speed = Math.hypot(npc.vx, npc.vy) || 1;
                for (let i = 1; i <= 3; i++) disc(x - npc.vx / speed * i * 14, z - npc.vy / speed * i * 14, 5 - i, '#66bcb9');
            }
            function part(px, py, pz, sx, sy, sz, hex) {
                const offset = rotate([px, py, pz], yaw, tilt);
                box(x + offset[0], base + offset[1], z + offset[2], sx, sy, sz, hex, yaw, tilt);
            }
            const step = npc.stun > 0 || flight ? 0 : Math.sin(player ? state.elapsed * 11 : npc.step) * 2;
            part(-6, 7 + step, 0, 8, 14, 9, '#182c36'); part(6, 7 - step, 0, 8, 14, 9, '#182c36');
            part(0, 26, 0, 25, 23, 15, npc.rampage ? glow : npc.flash > 0 ? '#fff0bc' : (player ? '#edb65f' : npc.color));
            part(-15, 27, -3, 6, 17, 7, player ? '#d3ae8b' : '#c2b19d');
            part(15, 27, -3, 6, 17, 7, player ? '#d3ae8b' : '#c2b19d');
            part(0, 45, -1, 18, 17, 17, '#d4bda5'); part(0, 55, 0, 19, 5, 18, player ? '#263e48' : '#354653');
            part(-4, 44, -10, 2, 2, 1, '#3a484b'); part(4, 44, -10, 2, 2, 1, '#3a484b');
            if (player) part(0, 26, 10, 17, 19, 7, '#6b5135');
            else if (npc.hasPhone !== false) {
                part(0, 29, -16, 9, 13, 3, '#102b36'); part(0, 29, -18, 6, 9, 1, '#82e6d7');
                part(-5, 27, -14, 5, 5, 5, '#d4bda5'); part(5, 27, -14, 5, 5, 5, '#d4bda5');
                if (npc.coffee) part(19, 22, -7, 6, 9, 6, '#e9d9b4');
            }
        }
        function render(state) {
            if (gl.isContextLost()) return;
            logicalWidth = state.width; logicalHeight = state.height;
            const ratio = Math.min(root.devicePixelRatio || 1, 1.5);
            const w = Math.round(logicalWidth * ratio), h = Math.round(logicalHeight * ratio);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // Fixed perspective keeps up/down movement aligned with the screen.
            viewProjection = multiply(perspective(Math.PI * .25, logicalWidth / logicalHeight, 10, 2200), lookAt([0, 790, 480], [0, 0, -8]));
            used = 0; station(state);
            if (state.attack) disc(state.player.x - state.width / 2, state.player.y - state.height / 2, state.attack.range, '#d4ab65', true);
            for (const npc of state.people) person(npc, state);
            person(state.player, state, true);
            for (const effect of state.particles) {
                const x = effect.x - state.width / 2, z = effect.y - state.height / 2;
                if (effect.type === 'phone') {
                    const age = effect.age || 0, elevation = 24 + Math.sin(Math.min(age, .6) / .6 * Math.PI) * 22;
                    box(x, elevation, z, 10, 3, 16, '#e8997c', age * 9);
                    box(x, elevation + 2, z, 6, 1, 9, '#ffc4ac', age * 9);
                    if (age > .3) for (let i = 0; i < 3; i++) box(x + (i - 1) * age * 24, Math.max(3, elevation - i * 6), z + i * age * 13, 3, 3, 5, i % 2 ? '#88decc' : '#ffc265', i + age * 5);
                }
                if (effect.type === 'coffee') disc(x, z, 13, '#977d55');
                if (effect.type === 'ring') disc(x, z, (1 - effect.life / .35) * 33 + 12, '#ecd6a2', true);
            }
            gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, used), gl.DYNAMIC_DRAW);
            gl.uniformMatrix4fv(matrixUniform, false, viewProjection); gl.drawArrays(gl.TRIANGLES, 0, used / 9);
        }
        return { render, project: (x, y, z) => project(viewProjection, x - logicalWidth / 2, y, z - logicalHeight / 2, logicalWidth, logicalHeight) };
    }
    const api = { createRenderer, multiply, perspective, lookAt, project };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SmartphoneRush3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
