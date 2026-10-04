import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Field, ImagePicker, Input, PageHeader } from './ui';

function DogForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !picture) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('picture', picture);

    try {
      const response = await fetch('/api/dogs', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        navigate('/');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Register a Dog" back={{ to: '/', label: 'Dogs' }} />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Picture" htmlFor="picture">
            <ImagePicker id="picture" onFileChange={setPicture} />
          </Field>
          <Button type="submit" size="lg" block loading={submitting}>
            {submitting ? 'Registering...' : 'Register Dog'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default DogForm;
