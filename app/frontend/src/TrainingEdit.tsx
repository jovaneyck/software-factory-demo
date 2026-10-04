import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Field, Input, LoadingState, MarkdownEditor, PageHeader } from './ui';

interface Training {
  id: string;
  name: string;
  procedure: string;
  tips: string;
}

function TrainingEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [procedure, setProcedure] = useState('');
  const [tips, setTips] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/trainings/${id}`)
      .then((res) => res.json())
      .then((data: Training) => {
        setName(data.name);
        setProcedure(data.procedure);
        setTips(data.tips);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/trainings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, procedure, tips }),
      });
      if (response.ok) {
        navigate(`/trainings/${id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Training" back={{ to: `/trainings/${id}`, label: 'Back' }} />
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

export default TrainingEdit;
