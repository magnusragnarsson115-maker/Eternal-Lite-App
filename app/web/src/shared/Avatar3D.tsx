import type * as T3 from 'three';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * Avatar 3D (runda 5): stylizowana sylwetka z brył, znaczniki w miejscach, dla których są dane w dokumentacji.
 * Kolor znacznika = świeżość i liczba danych (skala barwy panelu), NIGDY stan zdrowia — bez czerwieni i zieleni.
 * Poziom avatara rośnie z kompletnością dokumentacji (więcej obszarów z danymi → większa aura).
 * To nie jest model anatomii z badań obrazowych pacjenta (to robią certyfikowane wyroby, np. przeglądarki 3D CT/MR).
 * three.js ładowany dopiero tutaj (osobny plik), a lista obszarów obok jest pełnoprawną alternatywą dostępną.
 */

export interface AvatarRegion {
  key: string;
  label: string;
  count: number;
  lastDate?: string;
  recent: boolean;
  topics: string[];
}

export interface AvatarData {
  level: number;
  nextLevelAt: number;
  regionsWithData: number;
  dataPoints: number;
  lastUpdated?: string;
  newSince7d: number;
  regions: AvatarRegion[];
  rule: string;
}

const ANCHOR: Record<string, [number, number, number]> = {
  head: [0, 1.66, 0.24],
  neck: [0, 1.4, 0.13],
  heart: [0.09, 1.16, 0.27],
  lungs: [-0.14, 1.18, 0.25],
  liver: [-0.13, 0.95, 0.26],
  pancreas: [0.07, 0.9, 0.27],
  kidneys: [0, 0.88, -0.27],
  blood: [0.52, 0.86, 0.1],
  arms: [-0.52, 1.0, 0.08],
  legs: [0.17, 0.3, 0.13],
  body: [0, 0.7, 0.27],
};

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Avatar3D({ data, selected, onSelect, mode = 'clinical', height = 340 }: { data: AvatarData; selected?: string; onSelect?: (key: string) => void; mode?: 'clinical' | 'patient'; height?: number }) {
  const { t, fmt } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'fallback'>('loading');
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => undefined as void;
    (async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;
        const probe = document.createElement('canvas');
        if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
          setState('fallback');
          return;
        }
        const width = el.clientWidth || 320;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
        camera.position.set(0, 1.05, 4.1);
        camera.lookAt(0, 0.95, 0);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(2, 3, 4);
        scene.add(key);

        const bodyColor = new THREE.Color(cssVar('--primary-soft', '#e5eefa'));
        const edgeColor = new THREE.Color(cssVar('--primary', '#1f5fae'));
        const skin = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.92 });
        const figure = new THREE.Group();
        const part = (geo: T3.BufferGeometry, x: number, y: number, z = 0, rz = 0) => {
          const m = new THREE.Mesh(geo, skin);
          m.position.set(x, y, z);
          m.rotation.z = rz;
          figure.add(m);
          return m;
        };
        part(new THREE.SphereGeometry(0.24, 32, 24), 0, 1.66);
        part(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 20), 0, 1.4);
        const torso = part(new THREE.CapsuleGeometry(0.3, 0.5, 8, 24), 0, 1.02);
        torso.scale.set(1, 1, 0.72);
        const hips = part(new THREE.SphereGeometry(0.29, 24, 16), 0, 0.66);
        hips.scale.set(1, 0.62, 0.72);
        part(new THREE.CapsuleGeometry(0.075, 0.62, 6, 16), -0.45, 1.0, 0, -0.16);
        part(new THREE.CapsuleGeometry(0.075, 0.62, 6, 16), 0.45, 1.0, 0, 0.16);
        part(new THREE.CapsuleGeometry(0.1, 0.72, 6, 16), -0.15, 0.2, 0, 0.02);
        part(new THREE.CapsuleGeometry(0.1, 0.72, 6, 16), 0.15, 0.2, 0, -0.02);
        const outline = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.25 });
        figure.children.slice().forEach((c) => {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry((c as T3.Mesh).geometry, 35), outline);
          e.position.copy(c.position);
          e.rotation.copy(c.rotation);
          e.scale.copy(c.scale);
          figure.add(e);
        });
        scene.add(figure);

        // aura — rośnie z poziomem (kompletność dokumentacji)
        const auraMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cssVar('--data-2', '#a9c6ee')), transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const aura = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.42 + 0.06 * data.level, 64), auraMat);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = -0.22;
        figure.add(aura);

        // znaczniki obszarów z danymi
        const shades = ['--data-1', '--data-2', '--data-3', '--data-4'].map((v, i) => new THREE.Color(cssVar(v, ['#dfeaf8', '#a9c6ee', '#5b8fd6', '#184d8f'][i])));
        const maxCount = Math.max(1, ...data.regions.map((r) => r.count));
        const markers: { mesh: T3.Mesh; key: string; recent: boolean; base: number }[] = [];
        for (const r of data.regions) {
          const a = ANCHOR[r.key];
          if (!a || r.count === 0) continue;
          const level = r.recent ? (r.count / maxCount > 0.5 ? 3 : 2) : 1;
          const base = 0.045 + 0.035 * Math.min(1, r.count / maxCount);
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: shades[level], emissive: shades[level], emissiveIntensity: r.recent ? 0.45 : 0.15, roughness: 0.3 }));
          mesh.scale.setScalar(base);
          mesh.position.set(...a);
          mesh.userData.key = r.key;
          figure.add(mesh);
          markers.push({ mesh, key: r.key, recent: r.recent, base });
        }

        // tryb pacjenta: iskierki za nowe dane z 7 dni (zabawa, nie ocena)
        const sparkles: T3.Points[] = [];
        if (mode === 'patient' && data.newSince7d > 0) {
          const n = Math.min(60, 6 + data.newSince7d * 3);
          const pos = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2;
            pos.set([Math.cos(ang) * (0.7 + (i % 3) * 0.08), 0.2 + ((i * 37) % 100) / 60, Math.sin(ang) * (0.7 + (i % 3) * 0.08)], i * 3);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          const p = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(cssVar('--accent', '#b93d0c')), size: 0.035, transparent: true, opacity: 0.85 }));
          figure.add(p);
          sparkles.push(p);
        }

        // obrót przeciągnięciem, wybór znacznika kliknięciem
        let rotY = -0.35;
        let dragging = false;
        let lastX = 0;
        let moved = 0;
        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const dom = renderer.domElement;
        dom.style.touchAction = 'pan-y';
        dom.style.cursor = 'grab';
        const down = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          moved = 0;
          dom.setPointerCapture(e.pointerId);
        };
        const move = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          lastX = e.clientX;
          moved += Math.abs(dx);
          rotY += dx * 0.01;
        };
        const up = (e: PointerEvent) => {
          dragging = false;
          if (moved > 4) return;
          const rect = dom.getBoundingClientRect();
          ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          ray.setFromCamera(ndc, camera);
          const hit = ray.intersectObjects(markers.map((m) => m.mesh))[0];
          if (hit) selectRef.current?.(hit.object.userData.key as string);
        };
        dom.addEventListener('pointerdown', down);
        dom.addEventListener('pointermove', move);
        dom.addEventListener('pointerup', up);

        const still = reducedMotion();
        let raf = 0;
        let tick = 0;
        const loop = () => {
          tick += 1;
          if (!dragging && !still) rotY += 0.0025;
          figure.rotation.y = rotY;
          for (const m of markers) {
            const sel = selectedRef.current === m.key;
            const pulse = m.recent && !still ? 1 + 0.15 * Math.sin(tick / 18) : 1;
            m.mesh.scale.setScalar(m.base * pulse * (sel ? 1.6 : 1));
          }
          for (const s of sparkles) if (!still) s.rotation.y += 0.004;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        loop();
        const onResize = () => {
          const w = el.clientWidth || width;
          renderer.setSize(w, height);
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);
        setState('ok');
        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', onResize);
          dom.removeEventListener('pointerdown', down);
          dom.removeEventListener('pointermove', move);
          dom.removeEventListener('pointerup', up);
          scene.traverse((o) => {
            const m = o as T3.Mesh;
            m.geometry?.dispose();
            const mat = m.material as T3.Material | T3.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat?.dispose();
          });
          renderer.dispose();
          dom.remove();
        };
      } catch {
        if (!disposed) setState('fallback');
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [data, height, mode]);

  const withData = data.regions.filter((r) => r.count > 0);
  return (
    <div className="avatar3d">
      <div ref={host} className="avatar3d-canvas" style={{ height: state === 'fallback' ? undefined : height }} role="img" aria-label={t('Avatar: obszary ciała, dla których są dane w dokumentacji ({n})', { n: withData.length })}>
        {state === 'loading' && <div className="avatar3d-loading muted small">{t('Wczytywanie avatara…')}</div>}
        {state === 'fallback' && (
          <div className="muted small" style={{ padding: 12 }}>
            {t('Ta przeglądarka nie wyświetla grafiki 3D — obszary z danymi są na liście obok.')}
          </div>
        )}
      </div>
      <div className="avatar3d-side">
        <div className="avatar-level">
          <span className="avatar-level-badge">{t('Poziom {n}', { n: data.level })}</span>
          <span className="small muted">
            {t('{a} z {b} obszarów z danymi', { a: data.regionsWithData, b: data.regions.length })}
            {data.lastUpdated ? ` · ${t('ostatnie dane {d}', { d: fmt.date(data.lastUpdated) })}` : ''}
          </span>
        </div>
        <ul className="avatar-regions">
          {data.regions.map((r) => (
            <li key={r.key}>
              <button type="button" className={`avatar-region ${selected === r.key ? 'on' : ''} ${r.count ? '' : 'empty'}`} onClick={() => onSelect?.(r.key)} aria-pressed={selected === r.key} disabled={!r.count}>
                <span className="avatar-dot" data-fresh={r.count ? (r.recent ? 'recent' : 'old') : 'none'} aria-hidden />
                <span className="grow">{t(r.label)}</span>
                <span className="tabular small muted">{r.count ? r.count : '—'}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="small muted">{t(data.rule)}</p>
      </div>
    </div>
  );
}
