import { Line } from '@react-three/drei';

const AXIS_LENGTH = 1000;
const AXIS_COLORS = {
  x: '#E34D4D',
  y: '#7AB838',
  z: '#4D8FE3',
};

export function AxisLines() {
  return (
    <group>
      <Line
        points={[[-AXIS_LENGTH, 0, 0], [AXIS_LENGTH, 0, 0]]}
        color={AXIS_COLORS.x}
        lineWidth={1.5}
        transparent
        opacity={0.6}
      />
      <Line
        points={[[0, -AXIS_LENGTH, 0], [0, AXIS_LENGTH, 0]]}
        color={AXIS_COLORS.y}
        lineWidth={1.5}
        transparent
        opacity={0.6}
      />
      <Line
        points={[[0, 0, -AXIS_LENGTH], [0, 0, AXIS_LENGTH]]}
        color={AXIS_COLORS.z}
        lineWidth={1.5}
        transparent
        opacity={0.6}
      />
    </group>
  );
}
