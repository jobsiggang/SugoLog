// src/components/FormField.js

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

const FormField = React.memo(({
  field,
  value,
  onChange,
  isDate,
  options,
  validationError,
  onOpenDatePicker,
}) => {
  return (
    <View style={styles.formFieldContainer}>
      <Text style={styles.formFieldLabel}>{field}</Text>
      <View style={styles.inputWrapper}>
        {isDate ? (
          <TouchableOpacity
            style={[styles.inputBase, validationError && styles.inputError]}
            onPress={() => onOpenDatePicker(field)}
          >
            <Text style={styles.inputText}>{value || '날짜 선택'}</Text>
          </TouchableOpacity>
        ) : options && options.length > 0 ? (
          <ScrollView horizontal style={styles.optionsScroll} showsHorizontalScrollIndicator={false}>
            {options.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  value === option && styles.optionSelected,
                ]}
                onPress={() => onChange(option)}
              >
                <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>
                  {option === '' ? '값 없음' : option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TextInput
            style={[styles.inputBase, validationError && styles.inputError]}
            value={value}
            onChangeText={onChange}
            placeholder={field}
            placeholderTextColor="#9ca3af"
          />
        )}
        {validationError && <Text style={styles.errorText}>(필수)</Text>}
      </View>
    </View>
  );
});

export default FormField;

// --- FormField Styles ---
const styles = StyleSheet.create({
  formFieldContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    backgroundColor: '#fff' 
  },
  formFieldLabel: { 
    width: '20%', // 너비 조정
    textAlign: 'left', 
    padding: 8, 
    fontWeight: 'bold', 
    color: '#222', 
    fontSize: 14 
  },
  inputWrapper: {
    flex: 1,
    marginLeft: '0%',
  },
  inputBase: {
    padding: 8,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    margin: 4,
    textAlign: 'left',
    justifyContent: 'center',
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  inputText: { 
    fontSize: 14, 
    color: '#222', 
    textAlign: 'left' 
  },
  optionsScroll: { 
    padding: 4 
  },
  optionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
    alignItems: 'flex-start',
  },
  optionSelected: {
    backgroundColor: '#3b82f6',
  },
  optionText: { 
    color: '#222', 
    fontWeight: 'bold', 
    textAlign: 'left' 
  },
  optionTextSelected: {
    color: '#fff',
  },
  errorText: { 
    color: '#ef4444', 
    fontSize: 12, 
    paddingRight: 8,
    marginHorizontal: 4,
  },
});