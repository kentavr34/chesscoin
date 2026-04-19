// Inline Lucide-style icons — 1.75px stroke, currentColor.
const I = (d, extra) => (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 22} height={props.size || 22}
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={props.stroke || 1.75} strokeLinecap="round" strokeLinejoin="round"
       style={props.style}>{d}{extra}</svg>
);

const HomeIcon = I(<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>);
const GameIcon = I(<g><path d="M10 2v3m4-3v3M7 7h10l-1 4a5 5 0 0 1-8 0zM9 15v3M15 15v3M7 22h10"/></g>);
const BattlesIcon = I(<g><path d="M6 9h12M6 13h12M9 3v4m6-4v4M5 19l2-2h10l2 2M8 19v2m8-2v2"/></g>);
const WarsIcon = I(<g><path d="m13 4 3 3-9 9H4v-3zM14 7l3 3M17 4l3 3-2 2-3-3z"/></g>);
const ProfileIcon = I(<g><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></g>);

const SearchIcon = I(<g><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></g>);
const BellIcon = I(<g><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></g>);
const PlusIcon = I(<g><path d="M12 5v14M5 12h14"/></g>);
const ArrowUpIcon = I(<g><path d="M12 19V5M5 12l7-7 7 7"/></g>);
const ArrowDownIcon = I(<g><path d="M12 5v14M19 12l-7 7-7-7"/></g>);
const ClockIcon = I(<g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>);
const TrophyIcon = I(<g><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM5 4H3v2a2 2 0 0 0 2 2M19 4h2v2a2 2 0 0 1-2 2"/></g>);
const SwordIcon = I(<g><path d="m14 5 5 5-9 9H5v-5zM15 4l5 5"/></g>);
const CheckIcon = I(<g><path d="m5 12 5 5L20 7"/></g>);
const ChevRight = I(<g><path d="m9 6 6 6-6 6"/></g>);
const FlagIcon = I(<g><path d="M4 22V4M4 16h13l-2-4 2-4H4"/></g>);
const DotsIcon = I(<g><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></g>);
const SparkleIcon = I(<g><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l3 3M18 18l-3-3M18 6l-3 3M6 18l3-3"/></g>);
const LightningIcon = I(<g><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></g>);
const TonIcon = I(<g><path d="M2 8h20l-10 14z"/><path d="M12 22V8"/></g>);

Object.assign(window, {
  HomeIcon, GameIcon, BattlesIcon, WarsIcon, ProfileIcon,
  SearchIcon, BellIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon,
  ClockIcon, TrophyIcon, SwordIcon, CheckIcon, ChevRight,
  FlagIcon, DotsIcon, SparkleIcon, LightningIcon, TonIcon,
});
