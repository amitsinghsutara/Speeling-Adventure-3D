import * as THREE from "three";

export interface InstanceWriter {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
  readonly color: THREE.Color;
  readonly euler: THREE.Euler;
}

/**
 * Fills an InstancedMesh from plain layout data. Called once per layout from a
 * layout effect; nothing here runs per frame.
 */
export function writeInstances<T>(
  mesh: THREE.InstancedMesh,
  items: readonly T[],
  write: (item: T, index: number, out: InstanceWriter) => void,
): void {
  const out: InstanceWriter = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(1, 1, 1),
    euler: new THREE.Euler(),
  };
  const matrix = new THREE.Matrix4();
  const count = Math.min(items.length, mesh.count);

  for (let i = 0; i < count; i += 1) {
    const item = items[i];
    if (item === undefined) continue;
    out.position.set(0, 0, 0);
    out.euler.set(0, 0, 0);
    out.scale.set(1, 1, 1);
    out.color.set(1, 1, 1);
    write(item, i, out);
    out.quaternion.setFromEuler(out.euler);
    matrix.compose(out.position, out.quaternion, out.scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, out.color);
  }

  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}
