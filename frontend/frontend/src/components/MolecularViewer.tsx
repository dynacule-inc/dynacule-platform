import { useEffect, useRef } from 'react';
import * as NGL from 'ngl';
import { useStore } from '@/lib/store';
import { projectApi } from '@/lib/projectApi';

interface MolecularViewerProps {
  className?: string;
  projectId?: string | null;
}

export default function MolecularViewer({ className, projectId }: MolecularViewerProps) {
  const viewerRef = useRef<NGL.Stage | null>(null);
  const { 
    selectedProjectId, 
    selectedAtom,
    setSelectedAtom,
    setSelectedProjectId
  } = useStore();

  useEffect(() => {
    // If projectId changed and we have a viewer, load the new structure
    if (projectId && viewerRef.current) {
      loadProjectStructure(projectId);
    }
    
    // If no projectId, clear the viewer
    if (!projectId && viewerRef.current) {
      viewerRef.current.dispose();
      viewerRef.current = null;
    }
  }, [projectId]);

  useEffect(() => {
    const viewerContainer = document.createElement('div');
    viewerContainer.style.width = '100%';
    viewerContainer.style.height = '100%';
    viewerContainer.style.position = 'relative';

    const stage = new NGL.Stage(viewerContainer, {
      backgroundColor: 'white',
    });

    // Picking modes state
    let pickingMode: 'distance' | 'angle' | 'torsion' | null = null;
    let firstPickedAtom: NGL.Atom | null = null;
    let secondPickedAtom: NGL.Atom | null = null;
    let measurementLines: NGL.Component[] = [];

    // Update cursor based on picking mode
    const updateCursor = () => {
      if (!viewerContainer) return;
      
      switch (pickingMode) {
        case 'distance':
          viewerContainer.style.cursor = 'crosshair';
          break;
        case 'angle':
          // Simple crosshair for angle mode (can be customized later)
          viewerContainer.style.cursor = 'crosshair';
          break;
        case 'torsion':
          // Simple crosshair for torsion mode (can be customized later)
          viewerContainer.style.cursor = 'crosshair';
          break;
        default:
          viewerContainer.style.cursor = 'default';
          break;
      }
    };

    // Handle mouse clicks for atom selection and measurements
    // NGL has a built-in picking mechanism
    viewerContainer.addEventListener('click', (event) => {
      // Use NGL's picker
      const picked = stage.pick(event.clientX, event.clientY);
      if (!picked) return;

      // Get the atom from the picked object
      const atomProxy = picked.object;
      if (!atomProxy || !(atomProxy instanceof NGL.AtomProxy)) return;

      const atom = atomProxy.atom;

      // Update store with selected atom (for bidirectional binding with Project Table)
      setSelectedAtom(atom);

      // Handle picking modes for measurements
      if (pickingMode) {
        if (!firstPickedAtom) {
          firstPickedAtom = atom;
          // Visual feedback for first pick
          const firstSphere = atom.addSphere({
            radius: 0.5,
            color: 0xff0000,
          });
          measurementLines.push(firstSphere);
        } else if (!secondPickedAtom) {
          secondPickedAtom = atom;
          
          // Create measurement based on mode
          let measurement: NGL.Shape | null = null;
          
          switch (pickingMode) {
            case 'distance':
              measurement = stage.addShape({
                type: 'cylinder',
                position1: firstPickedAtom.position,
                position2: secondPickedAtom.position,
                radius: 0.1,
                color: 0xff0000,
              });
              break;
            // Angle and torsion would require more points - simplified for now
            case 'angle':
            case 'torsion':
              // For simplicity, we'll treat these as distance measurements too
              // In a full implementation, these would calculate angles/torsions
              measurement = stage.addShape({
                type: 'cylinder',
                position1: firstPickedAtom.position,
                position2: secondPickedAtom.position,
                radius: 0.1,
                color: 0xff0000,
              });
              break;
          }
          
          if (measurement) {
            // Need to add measurement to stage properly
            // stage.addShape returns a Shape, but we need to add it as a component
            const measurementComp = stage.addShapeFromObject(measurement);
            if (measurementComp) {
              measurementLines.push(measurementComp);
            }
          }
          
          // Reset for next measurement
          firstPickedAtom = null;
          secondPickedAtom = null;
          
          // Exit picking mode
          pickingMode = null;
          updateCursor();
        }
      }
    });

    // Load structure if projectId is provided
    if (projectId) {
      loadProjectStructure(projectId);
    }

    // Watch for selectedAtom changes from store (when Project Table row is selected)
    // This creates bidirectional binding
    const prevSelectedAtomRef = useRef(selectedAtom);
    
    useEffect(() => {
      if (selectedAtom !== prevSelectedAtomRef.current && stage) {
        prevSelectedAtomRef.current = selectedAtom;
        
        // Clear previous highlights
        stage.eachComponent((comp) => {
          if (comp.name && comp.name.startsWith('highlight-')) {
            stage.removeComponent(comp);
          }
        });
        
        // Highlight newly selected atom
        if (selectedAtom) {
          try {
            stage.eachComponent((comp) => {
              // Check if component has atomList (structure component)
              if (comp.atomList) {
                comp.atomList.eachAtom((atom: NGL.Atom) => {
                  // Match by index or serial number (simplified)
                  if (atom.index === selectedAtom.index || atom.serial === selectedAtom.serial) {
                    const highlight = atom.addSphere({
                      radius: 1.0,
                      color: 0xffff00,
                    });
                    highlight.name = `highlight-${atom.index}`;
                  }
                });
              }
            });
          } catch (error) {
            console.error('Failed to highlight atom:', error);
          }
        }
      }
    }, [selectedAtom, stage]);

    // Store reference
    viewerRef.current = stage;

    // Cleanup
    return () => {
      viewerContainer.removeEventListener('click', viewerContainer.clickHandler as any);
      measurementLines.forEach(line => stage.removeComponent(line));
      stage.dispose();
    };
  }, [projectId, selectedAtom]);

  // Load project structure from backend
  const loadProjectStructure = async (projectId: string) => {
    if (!viewerRef.current) return;
    
    const stage = viewerRef.current;
    
    try {
      // Try to load from backend
      const structureData = await projectApi.fetchProjectStructure(projectId);
      
      // Load the structure data
      await stage.loadString(structureData, {
        ext: structureData.includes('ATOM') ? 'pdb' : 'sdf'
      });
      
      // Auto-view the loaded structure
      stage.autoView();
      
      // Fetch and store atoms for bidirectional binding
      const projectAtoms = await projectApi.fetchProjectAtoms(projectId);
      // Note: In a real implementation, we'd store these in the store
      // For now, we'll just log them
      console.log(`Fetched ${projectAtoms.length} atoms for project ${projectId}`);
    } catch (error) {
      console.error('Failed to load structure from backend:', error);
      
      // Fallback to sample structure
      try {
        await stage.loadFile('https://raw.githubusercontent.com/nglviewer/ngl/master/sample-structures/protein.pdb');
        stage.autoView();
      } catch (fallbackError) {
        console.error('Failed to load fallback structure:', fallbackError);
      }
    }
  };

  // Functions to set picking modes (would be called from UI controls)
  // These would be exposed via context or props in a real implementation
  const setPickingMode = (mode: 'distance' | 'angle' | 'torsion' | null) => {
    // In a real implementation, these would modify state that triggers re-render
    // For now, we'll just note that UI controls would call these
    pickingMode = mode;
    updateCursor();
  };

  return <div ref={viewerRef} className={className} style={{ width: '100%', height: '100%' }} />;
}