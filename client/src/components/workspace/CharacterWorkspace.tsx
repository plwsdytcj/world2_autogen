import { Grid, Stack } from '@mantine/core';
import type { Project } from '../../types';
import { CharacterSources } from './CharacterSources';
import { CharacterEditor } from './CharacterEditor';
import { CharacterLorebookEntries } from './CharacterLorebookEntries';
import { useState } from 'react';

interface CharacterWorkspaceProps {
  project: Project;
}

export function CharacterWorkspace({ project }: CharacterWorkspaceProps) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const isCharacterLorebook = project.project_type === 'character_lorebook';

  return (
    <Stack>
      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <CharacterSources
            project={project}
            selectedSourceIds={selectedSourceIds}
            setSelectedSourceIds={setSelectedSourceIds}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack>
          <CharacterEditor project={project} selectedSourceIds={selectedSourceIds} />
            {isCharacterLorebook && <CharacterLorebookEntries project={project} />}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
