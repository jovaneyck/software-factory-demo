// DogTrainr design system. Import UI primitives from here: `import { Button, Card } from './ui'`.
// Catalog and rules: ./README.md. Live preview: /design-system.
export { cn } from './cn';
export { Avatar } from './Avatar';
export { Badge, type Tone } from './Badge';
export { Button, ButtonLink } from './Button';
export { buttonStyles, type ButtonVariant, type ButtonSize } from './buttonStyles';
export { Card, Section } from './Card';
export { ChoiceChip, SegmentedControl } from './Choice';
export { Field, ImagePicker, Input, Select, Textarea } from './Field';
export { IconButton, IconButtonLink } from './IconButton';
export { ListGroup, ListItem, ListItemIcon } from './List';
// Markdown/MarkdownEditor are intentionally not re-exported: import from './ui/Markdown' so the heavy
// markdown stack stays in lazily loaded route chunks.
export { Modal } from './Modal';
export { BackLink, PageHeader } from './PageHeader';
export { Spinner } from './Spinner';
export { EmptyState, ErrorState, LoadingState } from './States';
