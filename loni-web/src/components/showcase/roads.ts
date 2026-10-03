import nurseRoad from '../../assets/showcase/roads/nurse-road.svg';
import nurseLane from '../../assets/showcase/roads/nurse-lane.svg';
import nurseFade from '../../assets/showcase/roads/nurse-fade.svg';
import partnerRoad from '../../assets/showcase/roads/partner-road.svg';
import partnerLane from '../../assets/showcase/roads/partner-lane.svg';
import partnerFade from '../../assets/showcase/roads/partner-fade.svg';
import hospitalRoad from '../../assets/showcase/roads/hospital-road.svg';
import hospitalLane from '../../assets/showcase/roads/hospital-lane.svg';
import hospitalFade from '../../assets/showcase/roads/hospital-fade.svg';
import driverRoad from '../../assets/showcase/roads/driver-road.svg';
import driverLane from '../../assets/showcase/roads/driver-lane.svg';
import driverFade from '../../assets/showcase/roads/driver-fade.svg';

export interface ImageRect {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The Figma layer is mirrored horizontally. */
  flip?: boolean;
  rotate?: number;
}

export interface RoadConfig {
  id: 'nurse' | 'partner' | 'hospital' | 'driver';
  /** Which side of the phone the road runs out to. */
  side: 'left' | 'right';
  road: ImageRect;
  lane: ImageRect;
  /** Soft white blur that fades the far end of the road into the page. */
  fade: ImageRect;
  label: { text: string; cx: number; cy: number; rotate: number };
}

/** Positions are in Figma design pixels, relative to the 1466 x 686 roads frame. */
export const ROADS: RoadConfig[] = [
  {
    id: 'nurse',
    side: 'left',
    road: { src: nurseRoad, x: 68.13, y: 6.68, w: 584.066, h: 567.658 },
    lane: { src: nurseLane, x: 113.86, y: 39.07, w: 505.818, h: 505.632 },
    fade: { src: nurseFade, x: -116.07, y: -244.76, w: 565.378, h: 541.246 },
    label: { text: 'LONI Verified Nurse', cx: 340.61, cy: 409.12, rotate: 30.94 },
  },
  {
    id: 'partner',
    side: 'left',
    road: { src: partnerRoad, x: 3.53, y: 442.57, w: 738.209, h: 242.052 },
    lane: { src: partnerLane, x: 34.2, y: 472.21, w: 671.675, h: 178.866 },
    fade: { src: partnerFade, x: -211.45, y: 297.62, w: 492.982, h: 492.982 },
    label: { text: 'LONI Verified Partner', cx: 273.33, cy: 610.94, rotate: 30.94 },
  },
  {
    id: 'hospital',
    side: 'right',
    road: { src: hospitalRoad, x: 814.1, y: 6.74, w: 583.836, h: 567.614, flip: true },
    lane: { src: hospitalLane, x: 846.65, y: 39.07, w: 505.851, h: 505.626, flip: true },
    fade: { src: hospitalFade, x: 1053.78, y: -262.0, w: 578.019, h: 537.799 },
    label: { text: 'LONI Verified Hospital', cx: 1117.64, cy: 414.7, rotate: -30.94 },
  },
  {
    id: 'driver',
    side: 'right',
    road: { src: driverRoad, x: 724.57, y: 442.57, w: 738.209, h: 242.052, flip: true },
    lane: { src: driverLane, x: 760.74, y: 472.21, w: 671.675, h: 178.866, flip: true },
    fade: { src: driverFade, x: 1140.83, y: 282.53, w: 540.749, h: 540.749, rotate: -8.62 },
    label: { text: 'LONI Verified Driver', cx: 1183.08, cy: 612.63, rotate: -30.94 },
  },
];
