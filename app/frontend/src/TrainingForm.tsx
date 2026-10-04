import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, MarkdownEditor, PageHeader } from './ui';

function TrainingForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [tips, setTips] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, procedure, tips }),
      });
      if (response.ok) {
        navigate('/trainings');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Training" back={{ to: '/trainings', label: 'Back' }} />
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Procedure">
            <MarkdownEditor value={procedure} onChange={setProcedure} />
          </Field>
          <Field label="Tips">
            <MarkdownEditor value={tips} onChange={setTips} />
          </Field>
          <Button type="submit" size="lg" block loading={submitting}>
            {submitting ? 'Saving...' : 'Save Training'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default TrainingForm;
