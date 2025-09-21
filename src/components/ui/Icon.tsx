import * as LucideIcons from "lucide-react";
import { FC } from "react";

interface IconProps {
  name: keyof typeof LucideIcons;
  size?: number;
  className?: string;
}

const Icon: FC<IconProps> = ({ name, size = 20, className }) => {
  const LucideIcon = LucideIcons[name];
  
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in Lucide React`);
    return null;
  }
  
  return <LucideIcon size={size} className={className} />;
};

export default Icon;
