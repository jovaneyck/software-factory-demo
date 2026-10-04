import { Avatar, ListItem } from './ui';

interface Dog {
  id: string;
  name: string;
  picture: string;
}

type DogTileProps = { dog: Dog } & (
  { to: string; onClick?: never } | { onClick: () => void; to?: never }
);

/** Row for a dog. Render inside a `ListGroup`. */
function DogTile({ dog, ...target }: DogTileProps) {
  return (
    <ListItem
      {...target}
      title={dog.name}
      leading={
        <Avatar name={dog.name} src={dog.picture ? `/uploads/dogs/${dog.picture}` : undefined} />
      }
    />
  );
}

export default DogTile;
