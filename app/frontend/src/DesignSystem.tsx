import { useState } from 'react';
import { Dog, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  ChoiceChip,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  ListGroup,
  ListItem,
  ListItemIcon,
  LoadingState,
  Modal,
  PageHeader,
  Section,
  SegmentedControl,
  Select,
  Textarea,
} from './ui';

const SWATCHES = [
  ['brand-600', 'bg-brand-600'],
  ['brand-50', 'bg-brand-50'],
  ['ink', 'bg-ink'],
  ['ink-muted', 'bg-ink-muted'],
  ['ink-subtle', 'bg-ink-subtle'],
  ['canvas', 'bg-canvas'],
  ['surface', 'bg-surface'],
  ['surface-muted', 'bg-surface-muted'],
  ['line', 'bg-line'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
];

/** Living style guide at /design-system. Add every new primitive here. */
function DesignSystem() {
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Design system"
        description="Primitives from src/ui. Compose pages from these; don't restyle from scratch."
      />

      <Section title="Color tokens">
        <Card className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="space-y-1.5">
              <div className={`h-12 rounded-xl ring-1 ring-line ${cls}`} />
              <p className="text-xs font-medium text-ink-muted">{name}</p>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Typography">
        <Card className="space-y-2">
          <p className="text-3xl font-bold tracking-tight">Page title — PageHeader</p>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Section title — Section
          </p>
          <p className="text-[15px] font-semibold">Item title — ListItem</p>
          <p className="text-sm text-ink-muted">Secondary text — text-ink-muted</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <Card className="flex flex-wrap items-center gap-3">
          <Button icon={<Plus />}>Primary</Button>
          <Button variant="secondary" icon={<Pencil />}>
            Secondary
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 />}>
            Danger
          </Button>
          <Button loading>Loading</Button>
          <Button size="sm">Small</Button>
          <ButtonLink to="/design-system" size="lg">
            Large link
          </ButtonLink>
          <IconButton label="Add" icon={<Plus />} variant="primary" />
          <IconButton label="Edit" icon={<Pencil />} variant="secondary" />
        </Card>
      </Section>

      <Section title="Badges & avatars">
        <Card className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="success">8/10</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Avatar name="Bella" size="sm" />
          <Avatar name="Rex" />
          <Avatar name="Luna" size="lg" />
        </Card>
      </Section>

      <Section title="Forms">
        <Card className="space-y-5">
          <Field label="Text input" htmlFor="ds-input" hint="Hints sit below the control.">
            <Input id="ds-input" placeholder="Placeholder" />
          </Field>
          <Field label="With error" htmlFor="ds-error" error="This field is required.">
            <Input id="ds-error" />
          </Field>
          <Field label="Select" htmlFor="ds-select">
            <Select id="ds-select">
              <option>Option one</option>
              <option>Option two</option>
            </Select>
          </Field>
          <Field label="Textarea" htmlFor="ds-textarea">
            <Textarea id="ds-textarea" />
          </Field>
          <Field label="Choice chips">
            <div className="flex flex-wrap gap-2">
              <ChoiceChip type="checkbox" defaultChecked>
                Sit
              </ChoiceChip>
              <ChoiceChip type="checkbox">Stay</ChoiceChip>
              <ChoiceChip type="checkbox">Recall</ChoiceChip>
            </div>
          </Field>
          <Field label="Segmented control">
            <SegmentedControl
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Year', value: 'year' },
              ]}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Lists">
        <ListGroup>
          <ListItem
            to="/design-system"
            title="Bella"
            description="Avatar leading"
            leading={<Avatar name="Bella" />}
          />
          <ListItem
            to="/design-system"
            title="Sit"
            description="Icon leading, badge trailing"
            leading={
              <ListItemIcon>
                <Target />
              </ListItemIcon>
            }
            trailing={<Badge tone="success">New</Badge>}
          />
        </ListGroup>
      </Section>

      <Section title="States">
        <div className="space-y-4">
          <EmptyState
            icon={<Dog />}
            title="Nothing here yet"
            description="Explain what will appear and how to add it."
            action={<Button icon={<Plus />}>Primary action</Button>}
          />
          <ErrorState />
          <Card padding="none">
            <LoadingState />
          </Card>
        </div>
      </Section>

      <Section title="Modal">
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal title"
          description="Supporting description"
          footer={
            <Button block size="lg" onClick={() => setModalOpen(false)}>
              Confirm
            </Button>
          }
        >
          <p className="text-sm text-ink-muted">Modal body content.</p>
        </Modal>
      </Section>
    </div>
  );
}

export default DesignSystem;
