import { Component } from 'gea'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
  Dialog,
  Menu,
  Popover,
  Tooltip,
  HoverCard,
  Accordion,
  Collapsible,
  Combobox,
  Toaster,
  ToastStore,
  Clipboard,
  ToggleGroup,
  Pagination,
  RatingGroup,
  Badge,
} from 'gea-ui'

export default class App extends Component {
  template() {
    return (
      <div class="interactive-page">
        <div class="page-header">
          <h1>Interactive Components</h1>
          <p>Zag.js-powered components with full keyboard navigation, ARIA, and focus management.</p>
        </div>

        <div class="section">
          <h2>Dialog</h2>
          <p class="desc">Modal dialog with focus trap, escape-to-close, and backdrop click.</p>
          <div class="demo-row">
            <Dialog
              title="Delete Account"
              description="This action cannot be undone. This will permanently delete your account and remove your data from our servers."
              triggerLabel="Open Dialog"
            >
              <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
                <Button variant="outline">Cancel</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </Dialog>

            <Dialog
              title="Edit Profile"
              description="Make changes to your profile here."
              triggerLabel="Edit Profile"
              role="dialog"
            >
              <p style="font-size: 0.875rem;">Profile editing form would go here.</p>
            </Dialog>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Menu</h2>
          <p class="desc">Dropdown menu with keyboard navigation, typeahead, and separator support.</p>
          <div class="demo-row">
            <Menu
              triggerLabel="Actions"
              items={[
                { value: 'profile', label: 'My Profile' },
                { value: 'settings', label: 'Settings' },
                { value: 'billing', label: 'Billing' },
                { type: 'separator' },
                { value: 'team', label: 'Team' },
                { value: 'invite', label: 'Invite Users' },
                { type: 'separator' },
                { value: 'logout', label: 'Log Out' },
              ]}
              onSelect={(d: any) => console.log('Selected:', d.value)}
            />

            <Menu
              triggerLabel="File"
              items={[
                { value: 'new', label: 'New File' },
                { value: 'open', label: 'Open...' },
                { value: 'save', label: 'Save' },
                { type: 'separator' },
                { value: 'export', label: 'Export' },
              ]}
            />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Popover</h2>
          <p class="desc">Floating panel anchored to a trigger with auto-positioning.</p>
          <div class="demo-row">
            <Popover triggerLabel="Open Popover" title="Dimensions" description="Set the dimensions for this layer.">
              <div style="font-size: 0.875rem;">
                <p>Width: 100%</p>
                <p>Max width: 300px</p>
                <p>Height: auto</p>
              </div>
            </Popover>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Tooltip</h2>
          <p class="desc">Informational popup on hover with configurable delay.</p>
          <div class="demo-row">
            <Tooltip content="Add to library">
              <Button variant="outline">Hover for Tooltip</Button>
            </Tooltip>

            <Tooltip content="Bold (Ctrl+B)" openDelay={200}>
              <Button variant="outline" size="icon">
                B
              </Button>
            </Tooltip>

            <Tooltip content="Italic (Ctrl+I)" openDelay={200}>
              <Button variant="outline" size="icon">
                I
              </Button>
            </Tooltip>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Hover Card</h2>
          <p class="desc">Rich content preview on hover.</p>
          <div class="demo-row">
            <HoverCard triggerLabel="@geajs" href="https://github.com/dashersw/gea">
              <div style="font-size: 0.875rem;">
                <p style="font-weight: 600;">Gea Framework</p>
                <p style="color: hsl(var(--muted-foreground)); margin-top: 0.25rem;">
                  A lightweight, reactive JavaScript UI framework with proxy-based stores, JSX components, and automatic
                  DOM patching.
                </p>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                  <Badge variant="secondary">TypeScript</Badge>
                  <span style="color: hsl(var(--muted-foreground));">⭐ 1.2k</span>
                </div>
              </div>
            </HoverCard>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Accordion</h2>
          <p class="desc">Expandable sections with smooth transitions.</p>
          <div class="demo-box">
            <Accordion
              collapsible
              items={[
                {
                  value: 'item-1',
                  label: 'Is it accessible?',
                  content: 'Yes. It adheres to the WAI-ARIA design pattern.',
                },
                {
                  value: 'item-2',
                  label: 'Is it styled?',
                  content: 'Yes. It comes with Tailwind CSS styling that matches shadcn conventions.',
                },
                {
                  value: 'item-3',
                  label: 'Is it animated?',
                  content: 'Yes. It uses CSS animations for smooth open/close transitions.',
                },
              ]}
            />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Collapsible</h2>
          <p class="desc">A single expandable/collapsible section.</p>
          <div class="demo-box">
            <Collapsible label="Show Advanced Options">
              <div style="padding: 0.5rem 0; font-size: 0.875rem;">
                <p>These are advanced configuration options that most users don't need to change.</p>
                <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
                  <li>Custom DNS resolver</li>
                  <li>Connection pooling</li>
                  <li>Request timeout override</li>
                </ul>
              </div>
            </Collapsible>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Combobox</h2>
          <p class="desc">Searchable dropdown with keyboard navigation.</p>
          <div class="demo-box">
            <Combobox
              label="Select Framework"
              placeholder="Search frameworks..."
              items={[
                { value: 'gea', label: 'Gea' },
                { value: 'react', label: 'React' },
                { value: 'vue', label: 'Vue' },
                { value: 'svelte', label: 'Svelte' },
                { value: 'solid', label: 'SolidJS' },
                { value: 'angular', label: 'Angular' },
                { value: 'ember', label: 'Ember' },
              ]}
            />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Toggle Group</h2>
          <p class="desc">A group of toggle buttons with single or multiple selection.</p>
          <div class="demo-row">
            <ToggleGroup
              items={[
                { value: 'bold', label: 'B' },
                { value: 'italic', label: 'I' },
                { value: 'underline', label: 'U' },
                { value: 'strikethrough', label: 'S' },
              ]}
              multiple
            />

            <ToggleGroup
              items={[
                { value: 'left', label: '⬅' },
                { value: 'center', label: '⬌' },
                { value: 'right', label: '➡' },
              ]}
              defaultValue={['center']}
            />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Clipboard</h2>
          <p class="desc">Copy text to clipboard with feedback.</p>
          <div class="demo-box">
            <Clipboard label="API Key" value="sk-gea-ui-2024-abc123def456ghi789" />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Rating Group</h2>
          <p class="desc">Star rating input with keyboard support.</p>
          <div class="demo-row">
            <RatingGroup label="Rate this library" count={5} defaultValue={4} />
            <RatingGroup label="Half stars" count={5} allowHalf defaultValue={3.5} />
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Pagination</h2>
          <p class="desc">Page navigation with previous/next controls.</p>
          <div class="demo-box">
            <div class="mock-table">
              <div class="mock-table-row">
                <span>INV-001</span>
                <span>$250.00</span>
                <span>Paid</span>
              </div>
              <div class="mock-table-row">
                <span>INV-002</span>
                <span>$150.00</span>
                <span>Pending</span>
              </div>
              <div class="mock-table-row">
                <span>INV-003</span>
                <span>$350.00</span>
                <span>Paid</span>
              </div>
              <div class="mock-table-row">
                <span>INV-004</span>
                <span>$450.00</span>
                <span>Overdue</span>
              </div>
              <div class="mock-table-row">
                <span>INV-005</span>
                <span>$550.00</span>
                <span>Paid</span>
              </div>
            </div>
            <div style="margin-top: 1rem;">
              <Pagination count={50} defaultPageSize={5} onPageChange={(d: any) => console.log('Page:', d.page)} />
            </div>
          </div>
        </div>

        <Separator class="my-6" />

        <div class="section">
          <h2>Toast</h2>
          <p class="desc">Temporary notification messages with auto-dismiss.</p>
          <div class="demo-row">
            <Button
              click={() => ToastStore.success({ title: 'Success!', description: 'Your changes have been saved.' })}
            >
              Success Toast
            </Button>
            <Button
              variant="destructive"
              click={() => ToastStore.error({ title: 'Error', description: 'Something went wrong. Please try again.' })}
            >
              Error Toast
            </Button>
            <Button
              variant="outline"
              click={() => ToastStore.info({ title: 'Info', description: 'Here is some information for you.' })}
            >
              Info Toast
            </Button>
            <Button
              variant="secondary"
              click={() => ToastStore.loading({ title: 'Loading...', description: 'Please wait while we process.' })}
            >
              Loading Toast
            </Button>
          </div>
        </div>

        <Toaster />
      </div>
    )
  }
}
