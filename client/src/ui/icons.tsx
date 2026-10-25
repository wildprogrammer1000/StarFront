import {
  Building2,
  Check,
  Copy,
  Crosshair,
  Cylinder,
  Gem,
  Info,
  MapPin,
  Menu,
  ArrowRight,
  PawPrint,
  Pickaxe,
  Plus,
  ScrollText,
  Settings,
  Share2,
  Shield,
  Sword,
  Undo2,
  Users,
  X,
  Zap,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";

interface IconProps {
  size?: number;
}

function glyph(Icon: LucideIcon, fallback: number) {
  return function Glyph({ size = fallback }: IconProps) {
    return <Icon size={size} aria-hidden="true" />;
  };
}

/** 마름모 인장. Lucide에 종족 인장이 없고, Gem과 구분하려고 십자를 넣는다. */
const AlienMark = createLucideIcon("alien-mark", [
  ["path", { d: "M12 4 19.5 12 12 20 4.5 12Z", key: "a1" }],
  ["path", { d: "M12 9v6", key: "a2" }],
  ["path", { d: "M9 12h6", key: "a3" }],
]);

export const IconEnergy = glyph(Zap, 16);
export const IconMineral = glyph(Gem, 16);
export const IconGas = glyph(Cylinder, 16);
export const IconSupply = glyph(Users, 16);
export const IconHuman = glyph(Shield, 18);
export const IconMonster = glyph(PawPrint, 18);
export const IconAlien = glyph(AlienMark, 18);
export const IconCommand = glyph(Menu, 18);
export const IconInfo = glyph(Info, 14);
export const IconClose = glyph(X, 16);
export const IconNavBattle = glyph(Crosshair, 20);
export const IconNavRecord = glyph(ScrollText, 20);
export const IconNavSettings = glyph(Settings, 20);
export const IconPlus = glyph(Plus, 22);
export const IconBuild = glyph(Building2, 28);
export const IconUnit = glyph(Users, 28);
export const IconRally = glyph(MapPin, 28);
export const IconHarvest = glyph(Pickaxe, 28);
export const IconMove = glyph(ArrowRight, 28);
export const IconAttack = glyph(Sword, 28);
export const IconBack = glyph(Undo2, 28);
export const IconCheck = glyph(Check, 16);
export const IconCopy = glyph(Copy, 16);
export const IconShare = glyph(Share2, 16);
