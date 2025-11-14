# Probe Images TODO

## Required Images for Generalization Probes

The following images need to be added to `src/assets/photos/` to complete the generalization probe system:

### Easy Probes (Difficulty 1-2)
- `tree.jpg` - A clear photo of a tree
- `book.jpg` - A clear photo of a book
- `ball.jpg` - A clear photo of a ball
- `door.jpg` - A clear photo of a door

### Medium Probes (Difficulty 3-4)
- `shoe.jpg` - A clear photo of a shoe
- `watch.jpg` - A clear photo of a watch/wristwatch
- `flower.jpg` - A clear photo of a flower

### Hard Probes (Difficulty 4-5)
- `spoon.jpg` - A clear photo of a spoon
- `key.jpg` - A clear photo of a key
- `nose.jpg` - A clear photo of a nose (or face focusing on nose)

## Image Guidelines

1. **High quality**: Clear, well-lit photos with good resolution
2. **Simple backgrounds**: Minimize distractions to focus on the target object
3. **Typical examples**: Use prototypical examples (e.g., a common house key, not an ornate antique key)
4. **Consistent style**: Match the style of existing therapy photos in `assets/photos/`
5. **Appropriate framing**: Object should fill most of the frame
6. **Good contrast**: Clear separation between object and background

## After Adding Images

Once images are added, update `src/data/probeWords.ts`:

1. Replace placeholder paths (e.g., `/placeholder-tree.jpg`) with actual import statements:
   ```typescript
   import treeImg from '@/assets/photos/tree.jpg';
   ```

2. Update the `imageUrl` property for each probe:
   ```typescript
   imageUrl: treeImg,
   ```

## Testing

After adding images, test the probe system by:

1. Starting a photo-naming exercise
2. The probe should automatically trigger at session 1 (baseline)
3. Verify all images load correctly
4. Complete all 5 probe trials
5. Confirm results are logged and session proceeds to regular exercise

## Database Schema

Note: The probe results are currently logged to console. To persist them, create a `probe_results` table as outlined in the Phase 1 implementation plan (Week 3).
