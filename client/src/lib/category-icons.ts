import {
  Building2,
  Flame,
  Droplets,
  Zap,
  TreePine,
  Car,
  ParkingCircle,
  Dog,
  Tent,
  MapPin,
  Landmark,
  GraduationCap,
  Dumbbell,
  HeartPulse,
  ShieldCheck,
  Trash2,
  Truck,
  Wrench,
  Scale,
  BookOpen,
  Gavel,
  Receipt,
  FileCheck,
  BadgeDollarSign,
  Handshake,
  Home,
  Store,
  Factory,
  Shovel,
  Hammer,
  HardHat,
  Fence,
  Route,
  Waves,
  CloudRain,
  Ambulance,
  Siren,
  Shield,
  CreditCard,
  Banknote,
  Ticket,
  Camera,
  Megaphone,
  Users,
  Baby,
  Cake,
  Church,
  Briefcase,
  ClipboardList,
  FileText,
  Leaf,
  Mountain,
  Sun,
  type LucideIcon,
} from 'lucide-react';

interface IconMapping {
  keywords: string[];
  icon: LucideIcon;
  color: string;
  bg: string;
}

const ICON_MAPPINGS: IconMapping[] = [
  { keywords: ['building', 'plan', 'construct', 'demolit', 'erect', 'structur'], icon: Building2, color: 'text-orange-700', bg: 'bg-orange-100' },
  { keywords: ['fire', 'extinguish', 'alarm', 'hydrant', 'combusti'], icon: Flame, color: 'text-red-600', bg: 'bg-red-100' },
  { keywords: ['water', 'plumb', 'pipe', 'meter', 'borehole', 'irrigat', 'sewage', 'sewer', 'drain'], icon: Droplets, color: 'text-cyan-700', bg: 'bg-cyan-100' },
  { keywords: ['electric', 'power', 'energy', 'solar', 'prepaid', 'token', 'volt'], icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { keywords: ['park', 'garden', 'tree', 'green', 'landscap', 'horticultur', 'botanical'], icon: TreePine, color: 'text-green-700', bg: 'bg-green-100' },
  { keywords: ['vehicle', 'traffic', 'transport', 'road', 'highway', 'license', 'licence', 'motor'], icon: Car, color: 'text-blue-700', bg: 'bg-blue-100' },
  { keywords: ['parking', 'garage'], icon: ParkingCircle, color: 'text-indigo-700', bg: 'bg-indigo-100' },
  { keywords: ['animal', 'dog', 'cat', 'pet', 'kennel', 'pound', 'vet'], icon: Dog, color: 'text-amber-700', bg: 'bg-amber-100' },
  { keywords: ['camp', 'resort', 'caravan', 'chalet', 'holiday', 'accommod', 'tourism', 'tourist'], icon: Tent, color: 'text-teal-700', bg: 'bg-teal-100' },
  { keywords: ['land', 'property', 'erf', 'plot', 'subdivis', 'cadastr', 'survey', 'rezoning', 'zoning'], icon: MapPin, color: 'text-violet-700', bg: 'bg-violet-100' },
  { keywords: ['rates', 'valuation', 'assessment', 'municipal tax', 'levy'], icon: Landmark, color: 'text-slate-700', bg: 'bg-slate-100' },
  { keywords: ['library', 'book', 'education', 'school', 'bursary', 'scholar', 'training'], icon: GraduationCap, color: 'text-purple-700', bg: 'bg-purple-100' },
  { keywords: ['sport', 'stadium', 'gym', 'pool', 'swim', 'recreation', 'field', 'court'], icon: Dumbbell, color: 'text-sky-700', bg: 'bg-sky-100' },
  { keywords: ['health', 'clinic', 'medical', 'hospital', 'ambulanc', 'sanitat'], icon: HeartPulse, color: 'text-rose-700', bg: 'bg-rose-100' },
  { keywords: ['ambulanc', 'emergenc', 'rescue', 'disaster'], icon: Ambulance, color: 'text-red-700', bg: 'bg-red-100' },
  { keywords: ['security', 'cctv', 'surveillance', 'guard', 'patrol', 'safe'], icon: Shield, color: 'text-gray-700', bg: 'bg-gray-100' },
  { keywords: ['law', 'enforce', 'by-law', 'bylaw', 'fine', 'penalty', 'infring', 'contravention', 'prosecut'], icon: Gavel, color: 'text-red-800', bg: 'bg-red-50' },
  { keywords: ['refuse', 'waste', 'garbage', 'rubbish', 'dump', 'landfill', 'recycl', 'clean'], icon: Trash2, color: 'text-lime-700', bg: 'bg-lime-100' },
  { keywords: ['market', 'stall', 'vendor', 'hawker', 'trader', 'shop', 'business', 'commercial'], icon: Store, color: 'text-fuchsia-700', bg: 'bg-fuchsia-100' },
  { keywords: ['industrial', 'factory', 'manufactur'], icon: Factory, color: 'text-zinc-700', bg: 'bg-zinc-100' },
  { keywords: ['cemetery', 'burial', 'grave', 'funeral', 'cremation'], icon: Church, color: 'text-stone-700', bg: 'bg-stone-100' },
  { keywords: ['housing', 'house', 'dwelling', 'residen', 'settlement', 'shelter'], icon: Home, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { keywords: ['tender', 'procure', 'bid', 'contract', 'supply'], icon: Briefcase, color: 'text-blue-800', bg: 'bg-blue-50' },
  { keywords: ['rent', 'lease', 'hire', 'rental'], icon: Handshake, color: 'text-teal-700', bg: 'bg-teal-100' },
  { keywords: ['permit', 'certificate', 'clearance', 'approval', 'authoris', 'authoriz', 'compliance'], icon: FileCheck, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { keywords: ['deposit', 'fee', 'tariff', 'charge', 'payment', 'income', 'revenue', 'cash', 'money', 'financial'], icon: BadgeDollarSign, color: 'text-green-700', bg: 'bg-green-100' },
  { keywords: ['inspect', 'audit', 'check', 'exam', 'test', 'report', 'review'], icon: ClipboardList, color: 'text-orange-700', bg: 'bg-orange-100' },
  { keywords: ['advertis', 'signage', 'sign', 'banner', 'billboard', 'poster', 'notice'], icon: Megaphone, color: 'text-pink-700', bg: 'bg-pink-100' },
  { keywords: ['photo', 'copy', 'print', 'fax', 'document', 'stationery'], icon: Camera, color: 'text-gray-700', bg: 'bg-gray-100' },
  { keywords: ['maintain', 'repair', 'service', 'fix', 'restor'], icon: Wrench, color: 'text-slate-700', bg: 'bg-slate-100' },
  { keywords: ['construc', 'excavat', 'dig', 'earth', 'soil'], icon: Shovel, color: 'text-amber-800', bg: 'bg-amber-50' },
  { keywords: ['event', 'function', 'hall', 'venue', 'facility', 'community'], icon: Users, color: 'text-indigo-700', bg: 'bg-indigo-100' },
  { keywords: ['child', 'crèche', 'creche', 'youth', 'junior'], icon: Baby, color: 'text-pink-600', bg: 'bg-pink-100' },
  { keywords: ['environment', 'conservation', 'eco', 'nature', 'bio'], icon: Leaf, color: 'text-green-700', bg: 'bg-green-100' },
  { keywords: ['storm', 'flood', 'rain', 'weather'], icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-100' },
  { keywords: ['beach', 'coast', 'sea', 'ocean', 'harbour', 'harbor', 'marine', 'river', 'dam'], icon: Waves, color: 'text-blue-600', bg: 'bg-blue-100' },
  { keywords: ['road', 'street', 'pavement', 'sidewalk', 'bridge', 'infra'], icon: Route, color: 'text-slate-600', bg: 'bg-slate-100' },
  { keywords: ['ticket', 'admission', 'entry', 'access', 'gate'], icon: Ticket, color: 'text-purple-600', bg: 'bg-purple-100' },
  { keywords: ['legal', 'court', 'attorney', 'solicitor', 'advocate'], icon: Scale, color: 'text-slate-700', bg: 'bg-slate-100' },
];

const DEFAULT_ICON = { icon: CreditCard, color: 'text-emerald-700', bg: 'bg-emerald-100' };

export function getCategoryIcon(description: string): { icon: LucideIcon; color: string; bg: string } {
  const lower = description.toLowerCase();
  for (const mapping of ICON_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (lower.includes(keyword)) {
        return { icon: mapping.icon, color: mapping.color, bg: mapping.bg };
      }
    }
  }
  return DEFAULT_ICON;
}
