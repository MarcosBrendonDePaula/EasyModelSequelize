import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"

export class ComponentGenerator implements Generator {
    name = 'component'
    description = 'Generate a new React component'

    async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
        const template = this.getTemplate(options.template)

        if (template.hooks?.beforeGenerate) {
            await template.hooks.beforeGenerate(context, options)
        }

        const files = await templateEngine.processTemplate(template, context, options)

        if (options.dryRun) {
            console.log(`\n📋 Would generate component '${options.name}':\n`)
            for (const file of files) {
                console.log(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
            }
            return
        }

        await templateEngine.generateFiles(files, options.dryRun)

        if (template.hooks?.afterGenerate) {
            const filePaths = files.map(f => f.path)
            await template.hooks.afterGenerate(context, options, filePaths)
        }

        console.log(`\n✅ Generated component '${options.name}' with ${files.length} files`)
    }

    private getTemplate(templateName?: string): Template {
        switch (templateName) {
            case 'functional':
                return this.getFunctionalTemplate()
            case 'page':
                return this.getPageTemplate()
            case 'form':
                return this.getFormTemplate()
            case 'full':
                return this.getFullTemplate()
            default:
                return this.getBasicTemplate()
        }
    }

    private getBasicTemplate(): Template {
        return {
            name: 'basic-component',
            description: 'Basic React component with TypeScript',
            files: [
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.tsx',
                    content: `import React from 'react'
import './{{pascalName}}.css'

export interface {{pascalName}}Props {
  className?: string
  children?: React.ReactNode
}

export const {{pascalName}}: React.FC<{{pascalName}}Props> = ({ 
  className = '',
  children,
  ...props 
}) => {
  return (
    <div className={\`{{kebabName}} \${className}\`.trim()} {...props}>
      <h2>{{pascalName}} Component</h2>
      {children}
    </div>
  )
}

export default {{pascalName}}
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.css',
                    content: `.{{kebabName}} {
  /* Add your styles here */
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background-color: #ffffff;
}

.{{kebabName}} h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
}

/* Responsive styles */
@media (max-width: 768px) {
  .{{kebabName}} {
    padding: 0.75rem;
  }
  
  .{{kebabName}} h2 {
    font-size: 1.125rem;
  }
}
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}/index.ts',
                    content: `export { {{pascalName}}, type {{pascalName}}Props } from './{{pascalName}}'
export { default } from './{{pascalName}}'
`
                }
            ],
            hooks: {
                afterGenerate: async (context, options, files) => {
                    context.logger.info(`Generated component files:`)
                    files.forEach(file => {
                        context.logger.info(`  - ${file}`)
                    })
                    context.logger.info(`\nUsage example:`)
                    context.logger.info(`import { ${options.name} } from './components/${options.name}'`)
                    context.logger.info(`\n<${options.name}>Content here</${options.name}>`)
                }
            }
        }
    }

    private getFunctionalTemplate(): Template {
        return {
            name: 'functional-component',
            description: 'Functional component with hooks',
            files: [
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.tsx',
                    content: `import React, { useState, useEffect } from 'react'
import './{{pascalName}}.css'

export interface {{pascalName}}Props {
  className?: string
  onAction?: (data: any) => void
}

export const {{pascalName}}: React.FC<{{pascalName}}Props> = ({ 
  className = '',
  onAction,
  ...props 
}) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    // Component initialization logic
    console.log('{{pascalName}} mounted')
    
    return () => {
      // Cleanup logic
      console.log('{{pascalName}} unmounted')
    }
  }, [])

  const handleAction = async () => {
    setLoading(true)
    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000))
      const result = { message: 'Action completed', timestamp: new Date() }
      setData(result)
      onAction?.(result)
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={\`{{kebabName}} \${className}\`.trim()} {...props}>
      <h2>{{pascalName}}</h2>
      
      <div className="{{kebabName}}__content">
        {data && (
          <div className="{{kebabName}}__data">
            <p>Last action: {data.message}</p>
            <small>{data.timestamp?.toLocaleString()}</small>
          </div>
        )}
        
        <button 
          className="{{kebabName}}__button"
          onClick={handleAction}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Perform Action'}
        </button>
      </div>
    </div>
  )
}

export default {{pascalName}}
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.css',
                    content: `.{{kebabName}} {
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.{{kebabName}} h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
}

.{{kebabName}}__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.{{kebabName}}__data {
  padding: 1rem;
  background-color: #f7fafc;
  border-radius: 0.5rem;
  border-left: 4px solid #4299e1;
}

.{{kebabName}}__data p {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: #2d3748;
}

.{{kebabName}}__data small {
  color: #718096;
}

.{{kebabName}}__button {
  padding: 0.75rem 1.5rem;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.{{kebabName}}__button:hover:not(:disabled) {
  background-color: #3182ce;
}

.{{kebabName}}__button:disabled {
  background-color: #a0aec0;
  cursor: not-allowed;
}

/* Responsive styles */
@media (max-width: 768px) {
  .{{kebabName}} {
    padding: 1rem;
  }
  
  .{{kebabName}} h2 {
    font-size: 1.25rem;
  }
}
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}/index.ts',
                    content: `export { {{pascalName}}, type {{pascalName}}Props } from './{{pascalName}}'
export { default } from './{{pascalName}}'
`
                }
            ]
        }
    }

    private getPageTemplate(): Template {
        return {
            name: 'page-component',
            description: 'Page component with layout and SEO',
            files: [
                {
                    path: 'app/client/src/pages/{{pascalName}}Page/{{pascalName}}Page.tsx',
                    content: `import React, { useEffect } from 'react'
import './{{pascalName}}Page.css'

export interface {{pascalName}}PageProps {
  className?: string
}

export const {{pascalName}}Page: React.FC<{{pascalName}}PageProps> = ({ 
  className = '',
  ...props 
}) => {
  useEffect(() => {
    // Set page title
    document.title = '{{pascalName}} - FluxStack App'
    
    // Set meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', '{{pascalName}} page description')
    }
  }, [])

  return (
    <div className={\`{{kebabName}}-page \${className}\`.trim()} {...props}>
      <header className="{{kebabName}}-page__header">
        <h1>{{pascalName}}</h1>
        <p className="{{kebabName}}-page__subtitle">
          Welcome to the {{pascalName}} page
        </p>
      </header>

      <main className="{{kebabName}}-page__main">
        <section className="{{kebabName}}-page__section">
          <h2>Section Title</h2>
          <p>Add your page content here.</p>
        </section>
      </main>

      <footer className="{{kebabName}}-page__footer">
        <p>&copy; {new Date().getFullYear()} FluxStack App</p>
      </footer>
    </div>
  )
}

export default {{pascalName}}Page
`
                },
                {
                    path: 'app/client/src/pages/{{pascalName}}Page/{{pascalName}}Page.css',
                    content: `.{{kebabName}}-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.{{kebabName}}-page__header {
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
}

.{{kebabName}}-page__header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.{{kebabName}}-page__subtitle {
  margin: 0;
  font-size: 1.125rem;
  opacity: 0.9;
}

.{{kebabName}}-page__main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.{{kebabName}}-page__section {
  margin-bottom: 2rem;
}

.{{kebabName}}-page__section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: #2d3748;
}

.{{kebabName}}-page__section p {
  margin: 0;
  line-height: 1.6;
  color: #4a5568;
}

.{{kebabName}}-page__footer {
  padding: 1rem 2rem;
  background-color: #f7fafc;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  color: #718096;
}

/* Responsive styles */
@media (max-width: 768px) {
  .{{kebabName}}-page__header {
    padding: 1.5rem 1rem;
  }
  
  .{{kebabName}}-page__header h1 {
    font-size: 2rem;
  }
  
  .{{kebabName}}-page__main {
    padding: 1.5rem 1rem;
  }
  
  .{{kebabName}}-page__section h2 {
    font-size: 1.5rem;
  }
}
`
                },
                {
                    path: 'app/client/src/pages/{{pascalName}}Page/index.ts',
                    content: `export { {{pascalName}}Page, type {{pascalName}}PageProps } from './{{pascalName}}Page'
export { default } from './{{pascalName}}Page'
`
                }
            ]
        }
    }

    private getFormTemplate(): Template {
        return {
            name: 'form-component',
            description: 'Form component with validation',
            files: [
                {
                    path: 'app/client/src/components/{{pascalName}}Form/{{pascalName}}Form.tsx',
                    content: `import React, { useState } from 'react'
import './{{pascalName}}Form.css'

export interface {{pascalName}}FormData {
  name: string
  email: string
  message: string
}

export interface {{pascalName}}FormProps {
  className?: string
  onSubmit?: (data: {{pascalName}}FormData) => void | Promise<void>
  initialData?: Partial<{{pascalName}}FormData>
}

export const {{pascalName}}Form: React.FC<{{pascalName}}FormProps> = ({ 
  className = '',
  onSubmit,
  initialData = {},
  ...props 
}) => {
  const [formData, setFormData] = useState<{{pascalName}}FormData>({
    name: initialData.name || '',
    email: initialData.email || '',
    message: initialData.message || ''
  })
  
  const [errors, setErrors] = useState<Partial<{{pascalName}}FormData>>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Partial<{{pascalName}}FormData> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    try {
      await onSubmit?.(formData)
      // Reset form on successful submission
      setFormData({ name: '', email: '', message: '' })
      setErrors({})
    } catch (error) {
      console.error('Form submission failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof {{pascalName}}FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <form 
      className={\`{{kebabName}}-form \${className}\`.trim()} 
      onSubmit={handleSubmit}
      {...props}
    >
      <h2>{{pascalName}} Form</h2>
      
      <div className="{{kebabName}}-form__field">
        <label htmlFor="{{kebabName}}-name">Name *</label>
        <input
          id="{{kebabName}}-name"
          type="text"
          value={formData.name}
          onChange={handleChange('name')}
          className={errors.name ? 'error' : ''}
          placeholder="Enter your name"
        />
        {errors.name && <span className="{{kebabName}}-form__error">{errors.name}</span>}
      </div>

      <div className="{{kebabName}}-form__field">
        <label htmlFor="{{kebabName}}-email">Email *</label>
        <input
          id="{{kebabName}}-email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          className={errors.email ? 'error' : ''}
          placeholder="Enter your email"
        />
        {errors.email && <span className="{{kebabName}}-form__error">{errors.email}</span>}
      </div>

      <div className="{{kebabName}}-form__field">
        <label htmlFor="{{kebabName}}-message">Message *</label>
        <textarea
          id="{{kebabName}}-message"
          value={formData.message}
          onChange={handleChange('message')}
          className={errors.message ? 'error' : ''}
          placeholder="Enter your message"
          rows={4}
        />
        {errors.message && <span className="{{kebabName}}-form__error">{errors.message}</span>}
      </div>

      <button 
        type="submit" 
        className="{{kebabName}}-form__submit"
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}

export default {{pascalName}}Form
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}Form/{{pascalName}}Form.css',
                    content: `.{{kebabName}}-form {
  max-width: 500px;
  padding: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background-color: #ffffff;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.{{kebabName}}-form h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  text-align: center;
}

.{{kebabName}}-form__field {
  margin-bottom: 1.5rem;
}

.{{kebabName}}-form__field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.{{kebabName}}-form__field input,
.{{kebabName}}-form__field textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.{{kebabName}}-form__field input:focus,
.{{kebabName}}-form__field textarea:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.{{kebabName}}-form__field input.error,
.{{kebabName}}-form__field textarea.error {
  border-color: #e53e3e;
  box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
}

.{{kebabName}}-form__error {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: #e53e3e;
}

.{{kebabName}}-form__submit {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.{{kebabName}}-form__submit:hover:not(:disabled) {
  background-color: #3182ce;
}

.{{kebabName}}-form__submit:disabled {
  background-color: #a0aec0;
  cursor: not-allowed;
}

/* Responsive styles */
@media (max-width: 768px) {
  .{{kebabName}}-form {
    padding: 1.5rem;
  }
  
  .{{kebabName}}-form h2 {
    font-size: 1.25rem;
  }
}
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}Form/index.ts',
                    content: `export { {{pascalName}}Form, type {{pascalName}}FormProps, type {{pascalName}}FormData } from './{{pascalName}}Form'
export { default } from './{{pascalName}}Form'
`
                }
            ]
        }
    }

    private getFullTemplate(): Template {
        return {
            name: 'full-component',
            description: 'Complete component with tests and stories',
            files: [
                ...this.getBasicTemplate().files,
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.test.tsx',
                    content: `import React from 'react'
import { render, screen } from '@testing-library/react'
import { {{pascalName}} } from './{{pascalName}}'

describe('{{pascalName}}', () => {
  it('renders without crashing', () => {
    render(<{{pascalName}} />)
    expect(screen.getByText('{{pascalName}} Component')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<{{pascalName}} className="custom-class" />)
    expect(container.firstChild).toHaveClass('{{kebabName}}', 'custom-class')
  })

  it('renders children content', () => {
    render(
      <{{pascalName}}>
        <p>Test content</p>
      </{{pascalName}}>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
`
                },
                {
                    path: 'app/client/src/components/{{pascalName}}/{{pascalName}}.stories.tsx',
                    content: `import type { Meta, StoryObj } from '@storybook/react'
import { {{pascalName}} } from './{{pascalName}}'

const meta: Meta<typeof {{pascalName}}> = {
  title: 'Components/{{pascalName}}',
  component: {{pascalName}},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithCustomClass: Story = {
  args: {
    className: 'custom-styling',
  },
}

export const WithChildren: Story = {
  args: {
    children: (
      <div>
        <p>This is custom content inside the {{pascalName}} component.</p>
        <button>Click me</button>
      </div>
    ),
  },
}
`
                }
            ]
        }
    }
}