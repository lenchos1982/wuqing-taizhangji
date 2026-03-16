import React, { useState } from 'react';
import './FieldDefinition.css';

interface Field {
  id: number;
  name: string;
  type: 'text' | 'number' | 'date';
  template: 'invoice' | 'contract';
}

export const FieldDefinition: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'number' | 'date'>('text');
  const [template, setTemplate] = useState<'invoice' | 'contract'>('invoice');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newField: Field = {
      id: Date.now(),
      name: name.trim(),
      type,
      template,
    };

    setFields([...fields, newField]);
    setName('');
    setType('text');
    setTemplate('invoice');
  };

  const handleDelete = (id: number) => {
    setFields(fields.filter((field) => field.id !== id));
  };

  return (
    <div className="field-definition">
      <h2 className="field-definition__title">Field Definition</h2>

      <form className="field-definition__form" onSubmit={handleSubmit}>
        <div className="field-definition__field">
          <label htmlFor="fieldName" className="field-definition__label">
            Field Name
          </label>
          <input
            id="fieldName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter field name"
            className="field-definition__input"
          />
        </div>

        <div className="field-definition__field">
          <label htmlFor="fieldType" className="field-definition__label">
            Field Type
          </label>
          <select
            id="fieldType"
            value={type}
            onChange={(e) => setType(e.target.value as 'text' | 'number' | 'date')}
            className="field-definition__select"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
        </div>

        <div className="field-definition__field">
          <label htmlFor="templateType" className="field-definition__label">
            Template
          </label>
          <select
            id="templateType"
            value={template}
            onChange={(e) => setTemplate(e.target.value as 'invoice' | 'contract')}
            className="field-definition__select"
          >
            <option value="invoice">Invoice</option>
            <option value="contract">Contract</option>
          </select>
        </div>

        <button type="submit" className="field-definition__button">
          Add Field
        </button>
      </form>

      <div className="field-definition__list">
        <h3 className="field-definition__list-title">Defined Fields</h3>
        {fields.length === 0 ? (
          <p className="field-definition__empty">No fields defined yet.</p>
        ) : (
          <ul className="field-definition__items">
            {fields.map((field) => (
              <li key={field.id} className="field-definition__item">
                <div className="field-definition__item-info">
                  <span className="field-definition__item-name">{field.name}</span>
                  <span className="field-definition__item-type">{field.type}</span>
                  <span className="field-definition__item-template">{field.template}</span>
                </div>
                <button
                  onClick={() => handleDelete(field.id)}
                  className="field-definition__delete-button"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FieldDefinition;
